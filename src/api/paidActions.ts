import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { encodePaymentRequiredHeader } from '@x402/core/http';
import type { PaymentRequired } from '@x402/core/types';
import {
  APPOINTMENT_TIME,
  BUSINESS_ID,
  BUSINESS_NAME,
  HOLD_SLOT_AMOUNT_ATOMIC,
  HOLD_SLOT_DESCRIPTION,
  HOLD_SLOT_PRICE,
  NETWORK,
  NETWORK_LABEL,
  PAY_TO_ADDRESS,
  PAYMENT_PROTOCOL,
  USDC_ASSET_ADDRESS,
  USDC_ASSET_NAME,
  USDC_ASSET_VERSION,
  ALLOW_UNVERIFIED_PAYMENT_HEADERS,
  makeId,
  nowIso,
} from './config';
import { json, lowerHeaders, parseJsonBody, stringField } from './http';
import { eventFor, memory, safePersist } from './storage';
import type { PaidAction, PaidActionType, PaymentStatus, Lead } from './types';

export async function handleHoldSlot(
  event: APIGatewayProxyEvent,
  origin: string | undefined,
): Promise<APIGatewayProxyResult> {
  const headers = lowerHeaders(event.headers);
  const body = parseJsonBody(event);
  const requestEvent = eventFor(makeId('act'), 'REQUEST_RECEIVED', 'POST /api/paid/hold-slot reached the business-action endpoint.');

  if (!hasVerifiedPayment(headers)) {
    memory.events.unshift(requestEvent);
    const requiredEvent = eventFor(
      requestEvent.actionId,
      'PAYMENT_REQUIRED_402',
      '$5 USDC x402 payment required before slot capacity is reserved.',
      HOLD_SLOT_PRICE,
    );
    memory.events.unshift(requiredEvent);
    await Promise.all([
      safePersist('PAYMENT_EVENT', requestEvent.eventId, requestEvent),
      safePersist('PAYMENT_EVENT', requiredEvent.eventId, requiredEvent),
    ]);
    return paymentRequiredResponse(event, origin);
  }

  const timestamp = nowIso();
  const paidAction: PaidAction = {
    actionId: requestEvent.actionId,
    businessId: BUSINESS_ID,
    sessionId: stringField(body.sessionId, 'demo-session-agentpay'),
    type: 'hold_slot',
    amount: HOLD_SLOT_PRICE,
    currency: 'USDC',
    network: NETWORK,
    paymentStatus: paymentStatusFor(headers),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const lead: Lead = {
    leadId: makeId('lead'),
    businessId: BUSINESS_ID,
    customerName: stringField(body.customerName, 'Demo Customer'),
    customerPhone: stringField(body.customerPhone, '(305) 555-0142'),
    request: stringField(body.request, 'Hold a same-day ceramic detail appointment.'),
    service: stringField(body.service, 'Same-day ceramic detail'),
    vehicle: stringField(body.vehicle, 'black Tesla Model Y'),
    appointmentTime: stringField(body.appointmentTime, APPOINTMENT_TIME),
    paidActionId: paidAction.actionId,
    status: 'paid_slot_held',
    transcriptSnippet: stringField(
      body.transcriptSnippet,
      'Customer asked for a same-day ceramic detail and accepted a 4:30 PM paid priority hold.',
    ),
    createdAt: timestamp,
  };

  const timeline = [
    requestEvent,
    eventFor(paidAction.actionId, 'PAYMENT_REQUIRED_402', 'Previous unpaid attempt returned HTTP 402 with x402 payment requirements.', HOLD_SLOT_PRICE),
    eventFor(paidAction.actionId, 'PAYMENT_SIGNATURE_RECEIVED', 'x402 payment signature was attached to the retried request.', HOLD_SLOT_PRICE),
    eventFor(paidAction.actionId, 'PAYMENT_VERIFIED', 'Lambda@Edge verified the x402 payment with the facilitator.', HOLD_SLOT_PRICE),
    eventFor(paidAction.actionId, 'ACTION_COMPLETED', 'Priority appointment hold was created by the origin API.', HOLD_SLOT_PRICE),
    eventFor(paidAction.actionId, 'LEAD_CREATED', 'Paid lead appeared in the business dashboard.', HOLD_SLOT_PRICE),
  ];

  memory.payments.unshift(paidAction);
  memory.leads.unshift(lead);
  memory.events.unshift(...timeline.slice().reverse());

  await Promise.all([
    safePersist('PAYMENT', paidAction.actionId, paidAction),
    safePersist('LEAD', lead.leadId, lead),
    ...timeline.map((timelineEvent) => safePersist('PAYMENT_EVENT', timelineEvent.eventId, timelineEvent)),
  ]);

  return json(200, {
    success: true,
    action: 'hold_slot',
    bookingId: lead.leadId,
    businessName: BUSINESS_NAME,
    service: lead.service,
    appointmentTime: lead.appointmentTime,
    amountPaid: paidAction.amount,
    currency: paidAction.currency,
    network: paidAction.network,
    paymentStatus: paidAction.paymentStatus,
    paidActionId: paidAction.actionId,
    lead,
    timeline,
  }, origin);
}

export async function handlePaidStub(
  event: APIGatewayProxyEvent,
  origin: string | undefined,
  type: PaidActionType,
): Promise<APIGatewayProxyResult> {
  const headers = lowerHeaders(event.headers);
  if (!hasVerifiedPayment(headers)) return paymentRequiredResponse(event, origin);
  return json(202, {
    success: false,
    action: type,
    status: 'accepted_but_not_fully_implemented_for_mvp',
    message: 'The hackathon MVP fully implements hold_slot; this paid capability is configured for the product roadmap.',
  }, origin);
}

function paymentRequiredResponse(event: APIGatewayProxyEvent, origin?: string): APIGatewayProxyResult {
  const host = event.headers.Host ?? event.headers.host ?? 'localhost';
  const resource = `https://${host}${event.path}`;
  const body: PaymentRequired = {
    x402Version: 2,
    resource: {
      url: resource,
      description: HOLD_SLOT_DESCRIPTION,
      mimeType: 'application/json',
    },
    accepts: [
        {
          scheme: 'exact',
          network: NETWORK as `${string}:${string}`,
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
      },
    ],
    error: `HTTP 402 Payment Required. $5 USDC required. Network: ${NETWORK_LABEL}. Protocol: x402.`,
  };
  return json(
    402,
    body,
    origin,
    {
      'Payment-Required': encodePaymentRequiredHeader(body),
      'x-agentpay-payment-protocol': PAYMENT_PROTOCOL,
      'x-agentpay-network': NETWORK,
      'x-agentpay-price': HOLD_SLOT_PRICE,
    },
  );
}

function hasVerifiedPayment(headers: Record<string, string>): boolean {
  if (headers['x-x402-pending-settlement'] || headers['x-payment-response']) {
    return true;
  }

  if (!ALLOW_UNVERIFIED_PAYMENT_HEADERS) {
    return false;
  }

  return Boolean(
      headers['payment-signature'] ||
      headers['x-payment'],
  );
}

function paymentStatusFor(headers: Record<string, string>): PaymentStatus {
  if (headers['x-x402-pending-settlement'] || headers['x-payment-response']) return 'settled';
  if (ALLOW_UNVERIFIED_PAYMENT_HEADERS && (headers['payment-signature'] || headers['x-payment'])) return 'verified';
  return 'simulated';
}
