import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePaymentRequiredHeader } from '@x402/core/http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const staticRoot = path.join(root, 'frontend');
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || '127.0.0.1';

const BUSINESS_ID = 'miami-elite-auto-detail';
const BUSINESS_NAME = 'Miami Elite Auto Detail';
const NETWORK = 'eip155:84532';
const NETWORK_LABEL = 'Base Sepolia';
const PAY_TO_ADDRESS = process.env.PAY_TO_ADDRESS || '0x0000000000000000000000000000000000000402';
const APPOINTMENT_TIME = '2026-05-05T16:30:00-04:00';
const HOLD_SLOT_PRICE = '0.50';
const HOLD_SLOT_AMOUNT_ATOMIC = '500000';
const USDC_ASSET_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const USDC_ASSET_NAME = 'USDC';
const USDC_ASSET_VERSION = '2';
const SERVICE_CATALOG = [
  { service: 'Same-day ceramic detail', aliases: ['ceramic', 'detail', 'coating', 'same-day'], range: '$280-$450 depending on vehicle size and paint condition' },
  { service: 'Interior deep clean', aliases: ['interior', 'deep clean', 'seats', 'odor'], range: '$160-$260' },
  { service: 'Paint enhancement', aliases: ['paint', 'polish', 'swirl', 'correction'], range: '$350-$650' },
  { service: 'Fleet wash and detail', aliases: ['fleet', 'commercial', 'multiple cars'], range: 'quoted by vehicle count and cadence' },
];

const memory = {
  leads: [],
  payments: [],
  events: [],
};

function id(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function now() {
  return new Date().toISOString();
}

function json(res, status, body, headers = {}) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,x-payment,x-payment-response,payment-signature',
    ...headers,
  });
  res.end(JSON.stringify(body, null, 2));
}

async function bodyJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function lowerHeaders(req) {
  const out = {};
  for (const [key, value] of Object.entries(req.headers)) {
    out[key.toLowerCase()] = Array.isArray(value) ? value.join(',') : String(value || '');
  }
  return out;
}

function hasPayment(headers) {
  return Boolean(
    headers['x-x402-pending-settlement'] ||
    headers['x-payment-response'] ||
    headers['payment-signature'] ||
    headers['x-payment']
  );
}

function eventFor(actionId, status, detail, amount) {
  return {
    eventId: id('evt'),
    actionId,
    businessId: BUSINESS_ID,
    status,
    detail,
    timestamp: now(),
    protocol: 'x402',
    network: NETWORK,
    amount,
  };
}

function profile() {
  return {
    businessId: BUSINESS_ID,
    name: BUSINESS_NAME,
    industry: 'Mobile and studio auto detailing',
    serviceArea: 'Miami, Brickell, Wynwood, Coral Gables, Miami Beach',
    hours: 'Mon-Sat 8:00 AM-6:00 PM ET',
    services: [
      { name: 'Same-day ceramic detail', category: 'appointment', typicalPriceRange: '$280-$450', requiredQualifiers: ['vehicle', 'location', 'preferred time'] },
      { name: 'Interior deep clean', category: 'appointment', typicalPriceRange: '$160-$260', requiredQualifiers: ['vehicle', 'condition', 'location'] },
      { name: 'Paint enhancement', category: 'quote', typicalPriceRange: '$350-$650', requiredQualifiers: ['vehicle', 'paint condition', 'photos'] },
      { name: 'Fleet wash and detail', category: 'quote', typicalPriceRange: 'custom quote', requiredQualifiers: ['vehicle count', 'cadence', 'location'] },
    ],
    agentInstructions: [
      'Use free endpoints for discovery and normal questions.',
      'Do not pay for informational answers.',
      'Use paid endpoints only when creating business value: reserved capacity, verified quote intake, or priority callback.',
      'For hold_priority_slot, first expect HTTP 402 Payment Required, then retry with x402 payment.',
    ],
    demoScenario: {
      customerGoal: 'Hold a same-day ceramic detail appointment for a black Tesla Model Y in Miami.',
      recommendedAction: 'hold_priority_slot',
      appointmentTime: APPOINTMENT_TIME,
      expectedPayment: { amount: '0.50', currency: 'USDC', network: NETWORK, protocol: 'x402' },
    },
    freeCapabilities: [
      { action: 'answer_questions', endpoint: '/api/chat', method: 'POST' },
      { action: 'discover_business_profile', endpoint: '/api/agent/business-profile', method: 'GET' },
    ],
    paidCapabilities: [
      {
        action: 'hold_priority_slot',
        endpoint: '/api/paid/hold-slot',
        method: 'POST',
        price: '$0.50',
        currency: 'USDC',
        network: NETWORK,
        networkName: NETWORK_LABEL,
        protocol: 'x402',
        description: 'Hold a priority appointment slot with a local business receptionist.',
        inputSchema: {
          type: 'object',
          required: ['customerName', 'customerPhone', 'vehicle', 'service', 'appointmentTime'],
        },
      },
      { action: 'submit_verified_quote_request', endpoint: '/api/paid/quote-request', method: 'POST', price: '$1.00', currency: 'USDC', network: NETWORK, networkName: NETWORK_LABEL, protocol: 'x402' },
      { action: 'priority_callback', endpoint: '/api/paid/priority-callback', method: 'POST', price: '$2.00', currency: 'USDC', network: NETWORK, networkName: NETWORK_LABEL, protocol: 'x402' },
    ],
    payment: {
      scheme: 'exact',
      protocol: 'x402',
      defaultNetwork: NETWORK,
      defaultNetworkName: NETWORK_LABEL,
      payTo: PAY_TO_ADDRESS,
      facilitator: 'https://x402.org/facilitator',
      productionFacilitator: 'Coinbase Developer Platform x402 Facilitator',
      protectedRoutePattern: '/api/paid/**',
      protectedDemoRoute: 'POST /api/paid/hold-slot',
    },
  };
}

function chat(message, conversationHistory = []) {
  const lower = message.toLowerCase();
  const historyText = conversationHistory.map((entry) => entry?.text || '').join(' \n ').toLowerCase();
  const combinedText = `${historyText}\n${lower}`;
  const leadFields = extractLeadFields(message, combinedText);
  const requestedPaidAction = wantsPaidAction(lower);
  const wasOfferedHold = historyText.includes('4:30 pm priority') || historyText.includes('want me to hold');

  if (asksHours(lower)) {
    return freeResponse('Miami Elite Auto Detail is open Monday through Saturday, 8 AM to 6 PM. Same-day priority holds are available when capacity allows.', 'business_hours', leadFields);
  }
  if (asksLocation(lower)) {
    return freeResponse('We serve Miami, Brickell, Wynwood, Coral Gables, and Miami Beach. Mobile appointments can be held once the vehicle, service, and slot are clear.', 'service_area', leadFields);
  }
  if (asksPrice(lower) && !requestedPaidAction) {
    const service = findService(combinedText);
    return freeResponse(
      service
        ? `${service.service} usually runs ${service.range}. I can answer pricing questions free; payment is only needed to hold capacity or submit a verified request.`
        : 'Pricing depends on service, vehicle size, and condition. I can answer questions free; payment is only needed to hold capacity or submit a verified request.',
      'pricing_question',
      leadFields,
    );
  }
  if (/^(hi|hello|hey|yo|good morning|good afternoon)\b/i.test(lower)) {
    return freeResponse('Hi, I am the AI front desk for Miami Elite Auto Detail. What service are you looking for today?', 'greeting', leadFields);
  }
  if (requestedPaidAction || (isAffirmation(lower) && wasOfferedHold)) {
    if (!leadFields.service) {
      return qualificationResponse('I can help with that. Which service should I reserve: ceramic detail, interior deep clean, paint enhancement, or fleet detail?', 'missing_service', leadFields);
    }
    if (!leadFields.vehicle) {
      return qualificationResponse('I can help hold the slot. What vehicle are we detailing?', 'missing_vehicle', leadFields);
    }
    return paidHoldResponse(leadFields);
  }
  if (leadFields.service && !leadFields.vehicle) {
    return qualificationResponse(`We can likely fit ${withIndefiniteArticle(leadFields.service)} today. What vehicle are we detailing?`, 'qualify_vehicle', leadFields);
  }
  if (leadFields.service && leadFields.vehicle) {
    return qualificationResponse(`For the ${leadFields.vehicle}, I have a 4:30 PM priority ${leadFields.service.toLowerCase()} slot. Want me to hold it for a $0.50 USDC x402 deposit?`, 'offer_priority_slot', leadFields);
  }
  return freeResponse('I can answer service questions free, then create a paid action only when you want to hold a slot, submit a verified quote request, or request priority callback.', 'general_question', leadFields);
}

function freeResponse(reply, intent, leadFields) {
  return {
    reply,
    intent,
    requiresPayment: false,
    confidence: 0.88,
    actionBoundary: 'free_information',
    paidAction: null,
    suggestedNextStep: 'Continue free qualification.',
    agentInstructions: 'Keep informational answers free. Ask for payment only for a business action.',
    leadFields,
  };
}

function qualificationResponse(reply, intent, leadFields) {
  return {
    reply,
    intent,
    requiresPayment: false,
    confidence: 0.91,
    actionBoundary: 'qualification',
    paidAction: null,
    suggestedNextStep: 'Ask one qualifying question before requesting payment.',
    agentInstructions: 'Do not charge yet. Collect enough context to make the paid action specific and useful.',
    leadFields,
  };
}

function paidHoldResponse(leadFields) {
  return {
    reply: 'I can hold the 4:30 PM priority slot. A $0.50 USDC deposit over x402 is required before we reserve that appointment capacity.',
    intent: 'hold_priority_slot',
    requiresPayment: true,
    confidence: 0.96,
    actionBoundary: 'paid_business_action',
    paidAction: {
      type: 'hold_slot',
      endpoint: '/api/paid/hold-slot',
      price: '$0.50',
      currency: 'USDC',
      network: NETWORK,
      protocol: 'x402',
      reason: 'Reserve scarce same-day appointment capacity for a real business.',
    },
    suggestedNextStep: 'Call POST /api/paid/hold-slot. Expect HTTP 402 until x402 payment is attached.',
    agentInstructions: 'Only execute the paid action if the user or agent explicitly wants the slot held.',
    leadFields: { ...leadFields, appointmentTime: '4:30 PM ET' },
  };
}

function extractLeadFields(message, combinedText) {
  return {
    service: findService(combinedText)?.service || null,
    vehicle: findVehicle(message) || findVehicle(combinedText),
    location: findLocation(combinedText),
    appointmentTime: combinedText.includes('4:30') ? '4:30 PM ET' : null,
  };
}

function findService(text) {
  return SERVICE_CATALOG.find((service) => service.aliases.some((alias) => text.includes(alias))) || null;
}

function findVehicle(text) {
  const match = text.match(/\b((?:black|white|silver|blue|red|gray|grey)\s+)?(tesla model y|tesla model 3|tesla|bmw|mercedes|audi|porsche|range rover|lexus|toyota|honda|ford|truck|suv|sedan)\b/i);
  return match ? normalizeVehicle(match[0]) : null;
}

function findLocation(text) {
  const match = text.match(/\b(miami beach|brickell|wynwood|coral gables|miami)\b/i);
  return match ? titleCase(match[0]) : null;
}

function wantsPaidAction(text) {
  return /\b(hold|reserve|book|lock in|confirm|pay|paid|deposit)\b/i.test(text);
}

function asksHours(text) {
  return /\b(hour|hours|open|closed|close)\b/i.test(text);
}

function asksLocation(text) {
  return /\b(area|location|where|serve|mobile|come to|miami beach|brickell|wynwood|coral gables)\b/i.test(text);
}

function asksPrice(text) {
  return /\b(price|pricing|cost|quote|how much|rate)\b/i.test(text);
}

function isAffirmation(text) {
  return /^(yes|yeah|yep|sure|ok|okay|please do|do it|sounds good)\b/i.test(text.trim());
}

function normalizeVehicle(value) {
  return value.split(/\s+/).map((part) => /^[a-z]$/i.test(part) ? part.toUpperCase() : titleCase(part)).join(' ');
}

function titleCase(value) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function withIndefiniteArticle(value) {
  const lower = value.toLowerCase();
  const article = /^[aeiou]/.test(lower) ? 'an' : 'a';
  return `${article} ${lower}`;
}

function paymentRequired(req, res) {
  const resource = `http://${req.headers.host}${new URL(req.url, `http://${req.headers.host}`).pathname}`;
  const body = {
    x402Version: 2,
    resource: {
      url: resource,
      description: 'Hold a priority appointment slot with a local business receptionist.',
      mimeType: 'application/json',
    },
    accepts: [{
      scheme: 'exact',
      network: NETWORK,
      amount: HOLD_SLOT_AMOUNT_ATOMIC,
      asset: USDC_ASSET_ADDRESS,
      payTo: PAY_TO_ADDRESS,
      maxTimeoutSeconds: 300,
      extra: {
        name: USDC_ASSET_NAME,
        version: USDC_ASSET_VERSION,
        assetSymbol: 'USDC',
        businessName: BUSINESS_NAME,
        action: 'hold_priority_slot',
      },
    }],
    error: 'HTTP 402 Payment Required. $0.50 USDC required. Network: Base Sepolia. Protocol: x402.',
  };
  json(res, 402, body, {
    'Payment-Required': encodePaymentRequiredHeader(body),
    'x-agentpay-payment-protocol': 'x402',
    'x-agentpay-network': NETWORK,
    'x-agentpay-price': HOLD_SLOT_PRICE,
  });
}

async function holdSlot(req, res) {
  const headers = lowerHeaders(req);
  const body = await bodyJson(req);
  const actionId = id('act');
  const received = eventFor(actionId, 'REQUEST_RECEIVED', 'POST /api/paid/hold-slot reached the business-action endpoint.');

  if (!hasPayment(headers)) {
    const required = eventFor(actionId, 'PAYMENT_REQUIRED_402', '$0.50 USDC x402 payment required before slot capacity is reserved.', HOLD_SLOT_PRICE);
    memory.events.unshift(required, received);
    paymentRequired(req, res);
    return;
  }

  const createdAt = now();
  const payment = {
    actionId,
    businessId: BUSINESS_ID,
    sessionId: body.sessionId || 'demo-session-agentpay',
    type: 'hold_slot',
    amount: HOLD_SLOT_PRICE,
    currency: 'USDC',
    network: NETWORK,
    paymentStatus: headers['x-x402-pending-settlement'] || headers['x-payment-response'] ? 'settled' : 'verified',
    createdAt,
    updatedAt: createdAt,
  };
  const lead = {
    leadId: id('lead'),
    businessId: BUSINESS_ID,
    customerName: body.customerName || 'Demo Customer',
    customerPhone: body.customerPhone || '(305) 555-0142',
    request: body.request || 'Hold a same-day ceramic detail appointment.',
    service: body.service || 'Same-day ceramic detail',
    vehicle: body.vehicle || 'black Tesla Model Y',
    appointmentTime: body.appointmentTime || APPOINTMENT_TIME,
    paidActionId: actionId,
    status: 'paid_slot_held',
    transcriptSnippet: body.transcriptSnippet || 'Customer accepted a paid 4:30 PM priority hold.',
    createdAt,
  };
  const timeline = [
    received,
    eventFor(actionId, 'PAYMENT_REQUIRED_402', 'Previous unpaid attempt returned HTTP 402 with x402 payment requirements.', HOLD_SLOT_PRICE),
    eventFor(actionId, 'PAYMENT_SIGNATURE_RECEIVED', 'x402 payment signature was attached to the retried request.', HOLD_SLOT_PRICE),
    eventFor(actionId, 'PAYMENT_VERIFIED', 'Lambda@Edge verified the x402 payment with the facilitator.', HOLD_SLOT_PRICE),
    eventFor(actionId, 'ACTION_COMPLETED', 'Priority appointment hold was created by the origin API.', HOLD_SLOT_PRICE),
    eventFor(actionId, 'LEAD_CREATED', 'Paid lead appeared in the business dashboard.', HOLD_SLOT_PRICE),
  ];
  memory.payments.unshift(payment);
  memory.leads.unshift(lead);
  memory.events.unshift(...timeline.slice().reverse());

  json(res, 200, {
    success: true,
    action: 'hold_slot',
    bookingId: lead.leadId,
    businessName: BUSINESS_NAME,
    service: lead.service,
    appointmentTime: lead.appointmentTime,
    amountPaid: payment.amount,
    currency: payment.currency,
    network: payment.network,
    paymentStatus: payment.paymentStatus,
    paidActionId: actionId,
    lead,
    timeline,
  });
}

async function apiRoute(req, res, url) {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (url.pathname === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true, service: 'AgentPay Receptionist API', storage: 'mock-memory', network: NETWORK, protocol: 'x402', timestamp: now() });
  if (url.pathname === '/api/agent/business-profile' && req.method === 'GET') return json(res, 200, profile());
  if (url.pathname === '/api/chat' && req.method === 'POST') {
    const body = await bodyJson(req);
    return json(res, 200, chat(String(body.message || body.textFromUser || ''), Array.isArray(body.conversationHistory) ? body.conversationHistory : []));
  }
  if (url.pathname === '/api/paid/hold-slot' && req.method === 'POST') return holdSlot(req, res);
  if ((url.pathname === '/api/paid/quote-request' || url.pathname === '/api/paid/priority-callback') && req.method === 'POST') {
    const headers = lowerHeaders(req);
    if (!hasPayment(headers)) return paymentRequired(req, res);
    return json(res, 202, { success: false, status: 'accepted_but_not_fully_implemented_for_mvp' });
  }
  if (url.pathname === '/api/dashboard/leads' && req.method === 'GET') return json(res, 200, { businessName: BUSINESS_NAME, leads: memory.leads });
  if (url.pathname === '/api/dashboard/payments' && req.method === 'GET') return json(res, 200, { businessName: BUSINESS_NAME, payments: memory.payments, events: memory.events });
  if (url.pathname === '/api/dashboard/reset' && req.method === 'POST') {
    memory.leads = [];
    memory.payments = [];
    memory.events = [];
    return json(res, 200, { success: true, businessName: BUSINESS_NAME, message: 'Demo data reset for a clean judging run.', memoryCleared: true, dynamoDeleted: 0 });
  }
  return json(res, 404, { error: 'Not found', path: url.pathname, method: req.method });
}

async function staticRoute(_req, res, url) {
  const safePath = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.normalize(path.join(staticRoot, safePath));
  if (!filePath.startsWith(staticRoot)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  try {
    const body = await readFile(filePath);
    const ext = path.extname(filePath);
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
    };
    res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream' });
    res.end(body);
  } catch {
    const index = await readFile(path.join(staticRoot, 'index.html'));
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(index);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) await apiRoute(req, res, url);
    else await staticRoute(req, res, url);
  } catch (error) {
    json(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, host, () => {
  console.log(`AgentPay Receptionist local demo running at http://${host}:${port}`);
});
