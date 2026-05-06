import type { APIGatewayProxyEvent } from 'aws-lambda';
import { CHAT_RATE_LIMIT, CHAT_RATE_WINDOW_MS, NETWORK, PAYMENT_PROTOCOL } from './config';
import type { ChatResponse } from './types';

const chatHits = new Map<string, { windowStartedAt: number; count: number }>();

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

export function chatResponseFor(message: string): ChatResponse {
  const lower = message.toLowerCase();
  const mentionsCeramic = lower.includes('ceramic') || lower.includes('detail');
  const wantsAppointment =
    lower.includes('appointment') ||
    lower.includes('slot') ||
    lower.includes('book') ||
    lower.includes('hold') ||
    lower.includes('reserve');
  const asksPrice = lower.includes('price') || lower.includes('cost');
  const asksHours = lower.includes('hour') || lower.includes('open');
  const vehicleMatch = message.match(/\b(tesla|bmw|mercedes|audi|porsche|range rover|lexus|toyota|honda|ford|truck|suv|sedan)\b/i);

  if (asksHours) {
    return {
      reply: 'Miami Elite Auto Detail is open Monday through Saturday, 8 AM to 6 PM. Same-day priority holds are available when capacity allows.',
      intent: 'business_hours',
      requiresPayment: false,
      paidAction: null,
      leadFields: {},
    };
  }

  if (asksPrice && !wantsAppointment) {
    return {
      reply: 'Ceramic detail pricing depends on vehicle size and paint condition. I can answer questions free, and paid actions only happen when reserving capacity.',
      intent: 'pricing_question',
      requiresPayment: false,
      paidAction: null,
      leadFields: {},
    };
  }

  if (wantsAppointment && mentionsCeramic && !lower.includes('hold')) {
    return {
      reply: 'We can likely fit a same-day ceramic detail. What vehicle are we detailing?',
      intent: 'qualify_appointment',
      requiresPayment: false,
      paidAction: null,
      leadFields: {
        service: 'Same-day ceramic detail',
        appointmentTime: '4:30 PM ET',
      },
    };
  }

  if (wantsAppointment || lower.includes('yes') || lower.includes('4:30')) {
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
        protocol: PAYMENT_PROTOCOL,
        reason: 'Reserve scarce same-day appointment capacity.',
      },
      leadFields: {
        service: 'Same-day ceramic detail',
        vehicle: vehicleMatch?.[0] ?? null,
        appointmentTime: '4:30 PM ET',
      },
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

function getClientKey(event: APIGatewayProxyEvent): string {
  return event.requestContext.identity?.sourceIp ?? 'unknown';
}
