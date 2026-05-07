import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { businessProfile } from './businessProfile';
import { chatResponseFor, enforceChatRateLimit, parseConversationHistory } from './chat';
import { BUSINESS_NAME, NETWORK, PAYMENT_PROTOCOL, TABLE_NAME, nowIso } from './config';
import { handleDemoAgentBuyer } from './demoBuyer';
import { isAllowedOrigin, json, lowerHeaders, parseJsonBody, stringField } from './http';
import { handleHoldSlot, handlePaidStub } from './paidActions';
import { getStoredLeads, getStoredPayments, resetStoredData } from './storage';

async function route(event: APIGatewayProxyEvent, origin?: string): Promise<APIGatewayProxyResult> {
  const path = event.path.replace(/\/+$/, '') || '/';
  const method = event.httpMethod.toUpperCase();

  if (method === 'OPTIONS') {
    return json(204, {}, origin);
  }

  if (path === '/api/health' && method === 'GET') {
    return json(200, {
      ok: true,
      service: 'AgentPay Receptionist API',
      businessName: BUSINESS_NAME,
      network: NETWORK,
      protocol: PAYMENT_PROTOCOL,
      storage: TABLE_NAME ? 'dynamodb' : 'mock-memory',
      timestamp: nowIso(),
    }, origin);
  }

  if (path === '/api/agent/business-profile' && method === 'GET') {
    return json(200, businessProfile(), origin);
  }

  if (path === '/api/chat' && method === 'POST') {
    if (!enforceChatRateLimit(event)) {
      return json(429, { error: 'Too many chat requests. Please wait a moment and try again.' }, origin);
    }
    const body = parseJsonBody(event);
    const message = stringField(body.message, stringField(body.textFromUser));
    if (!message) {
      return json(400, { error: 'message is required.' }, origin);
    }
    return json(200, chatResponseFor({
      message,
      conversationHistory: parseConversationHistory(body.conversationHistory),
    }), origin);
  }

  if (path === '/api/demo/agent-buyer' && method === 'POST') {
    return handleDemoAgentBuyer(event, origin);
  }

  if (path === '/api/paid/hold-slot' && method === 'POST') {
    return handleHoldSlot(event, origin);
  }

  if (path === '/api/paid/quote-request' && method === 'POST') {
    return handlePaidStub(event, origin, 'quote_request');
  }

  if (path === '/api/paid/priority-callback' && method === 'POST') {
    return handlePaidStub(event, origin, 'priority_callback');
  }

  if (path === '/api/dashboard/leads' && method === 'GET') {
    const leads = await getStoredLeads();
    return json(200, { businessName: BUSINESS_NAME, leads }, origin);
  }

  if (path === '/api/dashboard/payments' && method === 'GET') {
    const payments = await getStoredPayments();
    return json(200, { businessName: BUSINESS_NAME, ...payments }, origin);
  }

  if (path === '/api/dashboard/reset' && method === 'POST') {
    const reset = await resetStoredData();
    return json(200, {
      success: true,
      businessName: BUSINESS_NAME,
      message: 'Demo data reset for a clean judging run.',
      ...reset,
    }, origin);
  }

  return json(404, { error: 'Not found', path, method }, origin);
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const headers = lowerHeaders(event.headers);
  const origin = headers.origin;
  if (!isAllowedOrigin(origin) && !['GET', 'HEAD', 'OPTIONS'].includes(event.httpMethod.toUpperCase())) {
    return json(403, { error: 'Forbidden - Invalid origin' }, origin);
  }

  try {
    return await route(event, origin);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return json(400, { error: 'Invalid JSON body.' }, origin);
    }
    if (error instanceof Error && error.name === 'PayloadTooLarge') {
      return json(413, { error: error.message }, origin);
    }
    console.error('AgentPay API error', error);
    return json(500, { error: 'Internal server error.' }, origin);
  }
};
