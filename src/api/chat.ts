import type { APIGatewayProxyEvent } from 'aws-lambda';
import { CHAT_RATE_LIMIT, CHAT_RATE_WINDOW_MS, NETWORK, PAYMENT_PROTOCOL } from './config';
import type { ChatResponse } from './types';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  role: ChatRole;
  text: string;
}

interface ChatInput {
  message: string;
  conversationHistory: ChatMessage[];
}

interface LeadFields extends Record<string, string | null> {
  service: string | null;
  vehicle: string | null;
  location: string | null;
  appointmentTime: string | null;
}

const chatHits = new Map<string, { windowStartedAt: number; count: number }>();

const SERVICE_CATALOG = [
  {
    service: 'Same-day ceramic detail',
    aliases: ['ceramic', 'detail', 'coating', 'same-day'],
    range: '$280-$450 depending on vehicle size and paint condition',
  },
  {
    service: 'Interior deep clean',
    aliases: ['interior', 'deep clean', 'seats', 'odor'],
    range: '$160-$260',
  },
  {
    service: 'Paint enhancement',
    aliases: ['paint', 'polish', 'swirl', 'correction'],
    range: '$350-$650',
  },
  {
    service: 'Fleet wash and detail',
    aliases: ['fleet', 'commercial', 'multiple cars'],
    range: 'quoted by vehicle count and cadence',
  },
];

export function enforceChatRateLimit(event: APIGatewayProxyEvent): boolean {
  const key = getClientKey(event);
  const current = Date.now();
  const hit = chatHits.get(key);
  if (!hit || current - hit.windowStartedAt > CHAT_RATE_WINDOW_MS) {
    chatHits.set(key, { windowStartedAt: current, count: 1 });
    return true;
  }
  hit.count += 1;
  return hit.count <= CHAT_RATE_LIMIT;
}

export function parseConversationHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const role = (item as { role?: unknown }).role;
      const text = (item as { text?: unknown; content?: unknown }).text ?? (item as { content?: unknown }).content;
      if ((role !== 'user' && role !== 'assistant') || typeof text !== 'string') return null;
      return { role, text };
    })
    .filter((item): item is ChatMessage => Boolean(item))
    .slice(-8);
}

export function chatResponseFor(input: ChatInput): ChatResponse {
  const message = input.message.trim();
  const lower = message.toLowerCase();
  const historyText = input.conversationHistory.map((entry) => entry.text).join(' \n ').toLowerCase();
  const combinedText = `${historyText}\n${lower}`;
  const leadFields = extractLeadFields(message, combinedText);
  const requestedPaidAction = wantsPaidAction(lower);
  const wasOfferedHold = historyText.includes('4:30 pm priority') || historyText.includes('want me to hold');

  if (asksHours(lower)) {
    return freeResponse(
      'Miami Elite Auto Detail is open Monday through Saturday, 8 AM to 6 PM. Same-day priority holds are available when capacity allows.',
      'business_hours',
      leadFields,
      'Answer free business-hours questions. Do not request payment.',
    );
  }

  if (asksLocation(lower)) {
    return freeResponse(
      'We serve Miami, Brickell, Wynwood, Coral Gables, and Miami Beach. Mobile appointments can be held once the vehicle, service, and slot are clear.',
      'service_area',
      leadFields,
      'Answer free location questions. Ask for a paid action only if the customer asks to reserve capacity.',
    );
  }

  if (asksPrice(lower) && !requestedPaidAction) {
    const service = findService(combinedText);
    return freeResponse(
      service
        ? `${service.service} usually runs ${service.range}. I can answer pricing questions free; payment is only needed to hold capacity or submit a verified request.`
        : 'Pricing depends on service, vehicle size, and condition. I can answer questions free; payment is only needed to hold capacity or submit a verified request.',
      'pricing_question',
      leadFields,
      'Keep pricing informational and free until the customer requests a business action.',
    );
  }

  if (isGreeting(lower)) {
    return freeResponse(
      'Hi, I am the AI front desk for Miami Elite Auto Detail. What service are you looking for today?',
      'greeting',
      leadFields,
      'Start qualification with one question. Do not claim to be human.',
    );
  }

  if (requestedPaidAction || (isAffirmation(lower) && wasOfferedHold)) {
    if (!leadFields.service) {
      return qualificationResponse(
        'I can help with that. Which service should I reserve: ceramic detail, interior deep clean, paint enhancement, or fleet detail?',
        'missing_service',
        leadFields,
      );
    }
    if (!leadFields.vehicle) {
      return qualificationResponse(
        'I can help hold the slot. What vehicle are we detailing?',
        'missing_vehicle',
        leadFields,
      );
    }
    return paidHoldResponse(leadFields);
  }

  if (leadFields.service && !leadFields.vehicle) {
    return qualificationResponse(
      `We can likely fit ${withIndefiniteArticle(leadFields.service)} today. What vehicle are we detailing?`,
      'qualify_vehicle',
      leadFields,
    );
  }

  if (leadFields.service && leadFields.vehicle) {
    return qualificationResponse(
      `For the ${leadFields.vehicle}, I have a 4:30 PM priority ${leadFields.service.toLowerCase()} slot. Want me to hold it for a $0.50 USDC x402 deposit?`,
      'offer_priority_slot',
      leadFields,
    );
  }

  return freeResponse(
    'I can answer service questions free, then create a paid action only when you want to hold a slot, submit a verified quote request, or request priority callback.',
    'general_question',
    leadFields,
    'Explain the free-versus-paid boundary and ask one qualifying question next.',
  );
}

function freeResponse(
  reply: string,
  intent: string,
  leadFields: LeadFields,
  agentInstructions: string,
): ChatResponse {
  return {
    reply,
    intent,
    requiresPayment: false,
    confidence: 0.88,
    actionBoundary: 'free_information',
    paidAction: null,
    suggestedNextStep: 'Continue free qualification.',
    agentInstructions,
    leadFields,
  };
}

function qualificationResponse(reply: string, intent: string, leadFields: LeadFields): ChatResponse {
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

function paidHoldResponse(leadFields: LeadFields): ChatResponse {
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
      protocol: PAYMENT_PROTOCOL,
      reason: 'Reserve scarce same-day appointment capacity for a real business.',
    },
    suggestedNextStep: 'Call POST /api/paid/hold-slot. Expect HTTP 402 until x402 payment is attached.',
    agentInstructions: 'Only execute the paid action if the user or agent explicitly wants the slot held.',
    leadFields: {
      ...leadFields,
      appointmentTime: '4:30 PM ET',
    },
  };
}

function extractLeadFields(message: string, combinedText: string): LeadFields {
  const service = findService(combinedText)?.service ?? null;
  const vehicle = findVehicle(message) ?? findVehicle(combinedText);
  const location = findLocation(combinedText);
  const appointmentTime = combinedText.includes('4:30') ? '4:30 PM ET' : null;
  return { service, vehicle, location, appointmentTime };
}

function findService(text: string): (typeof SERVICE_CATALOG)[number] | null {
  return SERVICE_CATALOG.find((service) =>
    service.aliases.some((alias) => text.includes(alias))
  ) ?? null;
}

function findVehicle(text: string): string | null {
  const match = text.match(/\b((?:black|white|silver|blue|red|gray|grey)\s+)?(tesla model y|tesla model 3|tesla|bmw|mercedes|audi|porsche|range rover|lexus|toyota|honda|ford|truck|suv|sedan)\b/i);
  return match ? normalizeVehicle(match[0]) : null;
}

function findLocation(text: string): string | null {
  const match = text.match(/\b(miami beach|brickell|wynwood|coral gables|miami)\b/i);
  return match ? titleCase(match[0]) : null;
}

function wantsPaidAction(text: string): boolean {
  return /\b(hold|reserve|book|lock in|confirm|pay|paid|deposit)\b/i.test(text);
}

function asksHours(text: string): boolean {
  return /\b(hour|hours|open|closed|close)\b/i.test(text);
}

function asksLocation(text: string): boolean {
  return /\b(area|location|where|serve|mobile|come to|miami beach|brickell|wynwood|coral gables)\b/i.test(text);
}

function asksPrice(text: string): boolean {
  return /\b(price|pricing|cost|quote|how much|rate)\b/i.test(text);
}

function isGreeting(text: string): boolean {
  return /^(hi|hello|hey|yo|good morning|good afternoon)\b/i.test(text);
}

function isAffirmation(text: string): boolean {
  return /^(yes|yeah|yep|sure|ok|okay|please do|do it|sounds good)\b/i.test(text.trim());
}

function normalizeVehicle(value: string): string {
  return value
    .split(/\s+/)
    .map((part) => /^[a-z]$/i.test(part) ? part.toUpperCase() : titleCase(part))
    .join(' ');
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function withIndefiniteArticle(value: string): string {
  const lower = value.toLowerCase();
  const article = /^[aeiou]/.test(lower) ? 'an' : 'a';
  return `${article} ${lower}`;
}

function getClientKey(event: APIGatewayProxyEvent): string {
  return event.requestContext.identity?.sourceIp ?? 'unknown';
}
