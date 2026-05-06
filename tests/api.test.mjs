import test from 'node:test';
import assert from 'node:assert/strict';
import apiModule from '../dist/src/api/handler.js';

const { handler } = apiModule;

const demoPayload = {
  sessionId: 'test-session',
  customerName: 'Ava Chen',
  customerPhone: '(305) 555-0142',
  vehicle: 'black Tesla Model Y',
  service: 'Same-day ceramic detail',
  request: 'Hold a same-day ceramic detail appointment at 4:30 PM.',
  appointmentTime: '2026-05-05T16:30:00-04:00',
  transcriptSnippet: 'Test agent accepted the $5 x402 priority hold.',
};

test('GET /api/agent/business-profile exposes free and paid capabilities', async () => {
  const response = await callApi('/api/agent/business-profile');
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.name, 'Miami Elite Auto Detail');
  assert.equal(response.body.payment.protocol, 'x402');
  assert.equal(response.body.payment.protectedDemoRoute, 'POST /api/paid/hold-slot');
  assert.ok(Array.isArray(response.body.agentInstructions));
  assert.ok(response.body.paidCapabilities.some((capability) => capability.endpoint === '/api/paid/hold-slot'));
});

test('POST /api/chat keeps questions free and avoids premature payment asks', async () => {
  const freeQuestion = await callApi('/api/chat', 'POST', { message: 'What hours are you open?' });
  assert.equal(freeQuestion.statusCode, 200);
  assert.equal(freeQuestion.body.requiresPayment, false);

  const blindAffirmation = await callApi('/api/chat', 'POST', { message: 'yes' });
  assert.equal(blindAffirmation.statusCode, 200);
  assert.equal(blindAffirmation.body.requiresPayment, false);
  assert.notEqual(blindAffirmation.body.intent, 'hold_priority_slot');
});

test('POST /api/chat qualifies before turning a hold into a paid business action', async () => {
  const qualifyVehicle = await callApi('/api/chat', 'POST', {
    message: 'I need a same-day ceramic detail appointment in Miami.',
    conversationHistory: [],
  });
  assert.equal(qualifyVehicle.statusCode, 200);
  assert.equal(qualifyVehicle.body.requiresPayment, false);
  assert.equal(qualifyVehicle.body.actionBoundary, 'qualification');

  const holdRequest = await callApi('/api/chat', 'POST', {
    message: 'It is a black Tesla Model Y. Please hold the 4:30 slot.',
    conversationHistory: [
      { role: 'user', text: 'I need a same-day ceramic detail appointment in Miami.' },
      { role: 'assistant', text: qualifyVehicle.body.reply },
    ],
  });
  assert.equal(holdRequest.statusCode, 200);
  assert.equal(holdRequest.body.requiresPayment, true);
  assert.equal(holdRequest.body.actionBoundary, 'paid_business_action');
  assert.equal(holdRequest.body.paidAction.endpoint, '/api/paid/hold-slot');
});

test('POST /api/paid/hold-slot returns HTTP 402 without x402 payment', async () => {
  await callApi('/api/dashboard/reset', 'POST');
  const response = await callApi('/api/paid/hold-slot', 'POST', demoPayload);
  assert.equal(response.statusCode, 402);
  assert.equal(response.body.x402Version, 2);
  assert.equal(response.body.accepts[0].network, 'eip155:84532');
  assert.equal(response.body.accepts[0].amount, '5000000');
  assert.ok(response.headers['Payment-Required']);
});

test('hold-slot rejects spoofed payment signatures unless the AWS edge verified payment first', async () => {
  await callApi('/api/dashboard/reset', 'POST');
  const response = await callApi('/api/paid/hold-slot', 'POST', demoPayload, {
    'PAYMENT-SIGNATURE': 'test-browser-signed-x402-payment-payload',
  });
  assert.equal(response.statusCode, 402);
});

test('edge-verified hold-slot creates booking JSON plus dashboard lead and payment records', async () => {
  await callApi('/api/dashboard/reset', 'POST');
  const response = await callApi('/api/paid/hold-slot', 'POST', demoPayload, {
    'x-x402-pending-settlement': 'edge-verified-payment-payload',
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.action, 'hold_slot');
  assert.equal(response.body.amountPaid, '5.00');
  assert.equal(response.body.paymentStatus, 'settled');
  assert.deepEqual(
    response.body.timeline.map((event) => event.status),
    [
      'REQUEST_RECEIVED',
      'PAYMENT_REQUIRED_402',
      'PAYMENT_SIGNATURE_RECEIVED',
      'PAYMENT_VERIFIED',
      'ACTION_COMPLETED',
      'LEAD_CREATED',
    ],
  );

  const leads = await callApi('/api/dashboard/leads');
  assert.equal(leads.statusCode, 200);
  assert.equal(leads.body.leads.length, 1);
  assert.equal(leads.body.leads[0].status, 'paid_slot_held');

  const payments = await callApi('/api/dashboard/payments');
  assert.equal(payments.statusCode, 200);
  assert.equal(payments.body.payments.length, 1);
  assert.ok(payments.body.events.some((event) => event.status === 'LEAD_CREATED'));
});

test('POST /api/dashboard/reset clears demo data', async () => {
  const reset = await callApi('/api/dashboard/reset', 'POST');
  assert.equal(reset.statusCode, 200);
  assert.equal(reset.body.success, true);

  const leads = await callApi('/api/dashboard/leads');
  const payments = await callApi('/api/dashboard/payments');
  assert.equal(leads.body.leads.length, 0);
  assert.equal(payments.body.payments.length, 0);
  assert.equal(payments.body.events.length, 0);
});

async function callApi(path, method = 'GET', body, headers = {}) {
  const response = await handler({
    path,
    httpMethod: method,
    headers: {
      Host: 'agentpay.test',
      ...headers,
    },
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: {
      identity: {
        sourceIp: '127.0.0.1',
      },
    },
    resource: path,
    body: body === undefined ? null : JSON.stringify(body),
    isBase64Encoded: false,
  });

  return {
    statusCode: response.statusCode,
    headers: response.headers || {},
    body: response.body ? JSON.parse(response.body) : null,
  };
}
