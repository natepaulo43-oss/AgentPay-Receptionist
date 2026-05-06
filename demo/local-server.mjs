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
const HOLD_SLOT_PRICE = '5.00';
const HOLD_SLOT_AMOUNT_ATOMIC = '5000000';
const USDC_ASSET_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const USDC_ASSET_NAME = 'USDC';
const USDC_ASSET_VERSION = '2';

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
    services: ['Same-day ceramic detail', 'Interior deep clean', 'Paint enhancement', 'Fleet wash and detail'],
    freeCapabilities: [
      { action: 'answer_questions', endpoint: '/api/chat', method: 'POST' },
      { action: 'discover_business_profile', endpoint: '/api/agent/business-profile', method: 'GET' },
    ],
    paidCapabilities: [
      { action: 'hold_priority_slot', endpoint: '/api/paid/hold-slot', method: 'POST', price: '$5.00', currency: 'USDC', network: NETWORK, networkName: NETWORK_LABEL, protocol: 'x402' },
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
    },
  };
}

function chat(message) {
  const lower = message.toLowerCase();
  if (lower.includes('hour') || lower.includes('open')) {
    return {
      reply: 'Miami Elite Auto Detail is open Monday through Saturday, 8 AM to 6 PM. Same-day priority holds are available when capacity allows.',
      intent: 'business_hours',
      requiresPayment: false,
      paidAction: null,
      leadFields: {},
    };
  }
  if ((lower.includes('same-day') || lower.includes('appointment')) && !lower.includes('hold')) {
    return {
      reply: 'We can likely fit a same-day ceramic detail. What vehicle are we detailing?',
      intent: 'qualify_appointment',
      requiresPayment: false,
      paidAction: null,
      leadFields: { service: 'Same-day ceramic detail', appointmentTime: '4:30 PM ET' },
    };
  }
  if (lower.includes('hold') || lower.includes('4:30') || lower.includes('yes')) {
    return {
      reply: 'I can offer a 4:30 PM priority appointment hold. A $5 USDC deposit over x402 is required to reserve that slot.',
      intent: 'hold_priority_slot',
      requiresPayment: true,
      paidAction: {
        type: 'hold_slot',
        endpoint: '/api/paid/hold-slot',
        price: '$5.00',
        currency: 'USDC',
        network: NETWORK,
        protocol: 'x402',
        reason: 'Reserve scarce same-day appointment capacity.',
      },
      leadFields: { service: 'Same-day ceramic detail', appointmentTime: '4:30 PM ET' },
    };
  }
  return {
    reply: 'Hi, I am the AI front desk for Miami Elite Auto Detail. I can answer questions free, qualify a request, or help hold a paid priority slot.',
    intent: 'greeting',
    requiresPayment: false,
    paidAction: null,
    leadFields: {},
  };
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
    error: 'HTTP 402 Payment Required. $5 USDC required. Network: Base Sepolia. Protocol: x402.',
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
    const required = eventFor(actionId, 'PAYMENT_REQUIRED_402', '$5 USDC x402 payment required before slot capacity is reserved.', HOLD_SLOT_PRICE);
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
    return json(res, 200, chat(String(body.message || body.textFromUser || '')));
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
