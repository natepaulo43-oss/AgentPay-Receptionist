import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ExactEvmScheme, toClientEvmSigner } from '@x402/evm';
import { decodePaymentResponseHeader, wrapFetchWithPaymentFromConfig } from '@x402/fetch';
import { privateKeyToAccount } from 'viem/accounts';
import { AGENTPAY_PUBLIC_BASE_URL, APPOINTMENT_TIME, DEMO_BUYER_PRIVATE_KEY } from './config';
import { json, lowerHeaders, parseJsonBody, stringField } from './http';

const DEMO_BUYER_PAYLOAD = {
  sessionId: 'agent-web-x402-buyer',
  customerName: 'Autonomous Agent',
  customerPhone: '(305) 555-0142',
  vehicle: 'black Tesla Model Y',
  service: 'Same-day ceramic detail',
  request: 'Hold a same-day ceramic detail appointment at 4:30 PM.',
  appointmentTime: APPOINTMENT_TIME,
  transcriptSnippet:
    'Website demo buyer discovered the paid capability, received HTTP 402, paid with x402, and booked the hold.',
};

type FetchJsonResult = {
  status: number;
  ok: boolean;
  body: unknown;
  paymentResponse: unknown;
};

export async function handleDemoAgentBuyer(
  event: APIGatewayProxyEvent,
  origin?: string,
): Promise<APIGatewayProxyResult> {
  const privateKey = normalizePrivateKey(DEMO_BUYER_PRIVATE_KEY);
  if (!privateKey) {
    return json(503, {
      success: false,
      configured: false,
      error: 'DEMO_BUYER_PRIVATE_KEY is not configured for the server-side demo buyer.',
      nextStep:
        'Deploy once with DemoBuyerPrivateKey set to a funded Base Sepolia test wallet, then this button can run without terminal commands.',
    }, origin);
  }

  const body = parseJsonBody(event);
  const baseUrl = resolveBaseUrl(event, body);
  if (!baseUrl) {
    return json(400, {
      success: false,
      error: 'A valid AgentPay baseUrl is required.',
      allowedExamples: [
        'https://d2pc20oig2383p.cloudfront.net',
        'https://your-cloudfront-domain.cloudfront.net',
      ],
    }, origin);
  }

  try {
    const account = privateKeyToAccount(privateKey);
    const signer = toClientEvmSigner(account);
    const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
      schemes: [
        {
          network: 'eip155:*',
          client: new ExactEvmScheme(signer),
        },
      ],
    });

    const profileUrl = `${baseUrl}/api/agent/business-profile`;
    const holdSlotUrl = `${baseUrl}/api/paid/hold-slot`;

    const profile = await fetchJson(profileUrl);
    const unpaid = await fetchJson(holdSlotUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(DEMO_BUYER_PAYLOAD),
    });

    if (unpaid.status !== 402) {
      return json(502, {
        success: false,
        configured: true,
        stage: 'PAYMENT_REQUIRED_402',
        error: `Expected HTTP 402 from ${holdSlotUrl}, received HTTP ${unpaid.status}.`,
        profile: profile.body,
        unpaidStatus: unpaid.status,
        unpaidBody: unpaid.body,
      }, origin);
    }

    const paid = await fetchJson(holdSlotUrl, {
      fetcher: fetchWithPayment,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(DEMO_BUYER_PAYLOAD),
    });

    const booking = paid.body && typeof paid.body === 'object'
      ? (paid.body as Record<string, unknown>)
      : {};

    return json(paid.ok ? 200 : 502, {
      success: paid.ok,
      configured: true,
      mode: 'server_side_demo_buyer',
      buyerAddress: account.address,
      baseUrl,
      summary: paid.ok
        ? 'Agent discovered the business, hit HTTP 402, paid $0.50 USDC over x402, and created a booking lead.'
        : `Payment retry returned HTTP ${paid.status}.`,
      profile: profile.body,
      steps: [
        'DISCOVERED_BUSINESS_PROFILE',
        'PAYMENT_REQUIRED_402',
        'PAYMENT_SIGNATURE_RECEIVED',
        'PAYMENT_VERIFIED',
        'ACTION_COMPLETED',
        'LEAD_CREATED',
      ],
      unpaidStatus: unpaid.status,
      unpaidPaymentRequirement: unpaid.body,
      paidStatus: paid.status,
      paymentResponse: paid.paymentResponse,
      booking,
      bookingId: stringValue(booking.bookingId),
      paidActionId: stringValue(booking.paidActionId),
      amountPaid: stringValue(booking.amountPaid),
      currency: stringValue(booking.currency),
      network: stringValue(booking.network),
      paymentStatus: stringValue(booking.paymentStatus),
    }, origin);
  } catch (error) {
    return json(502, {
      success: false,
      configured: true,
      stage: 'SERVER_SIDE_DEMO_BUYER',
      error: error instanceof Error ? error.message : String(error),
    }, origin);
  }
}

async function fetchJson(
  url: string,
  options: RequestInit & { fetcher?: typeof fetch } = {},
): Promise<FetchJsonResult> {
  const { fetcher = fetch, ...init } = options;
  const response = await fetcher(url, init);
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }

  const paymentResponseHeader = response.headers.get('x-payment-response');
  let paymentResponse: unknown = null;
  if (paymentResponseHeader) {
    try {
      paymentResponse = decodePaymentResponseHeader(paymentResponseHeader);
    } catch {
      paymentResponse = { raw: paymentResponseHeader };
    }
  }

  return {
    status: response.status,
    ok: response.ok,
    body,
    paymentResponse,
  };
}

function resolveBaseUrl(event: APIGatewayProxyEvent, body: Record<string, unknown>): string | null {
  const requested = stringField(body.baseUrl, AGENTPAY_PUBLIC_BASE_URL);
  const candidate = requested || baseUrlFromEvent(event);
  return allowlistedBaseUrl(candidate);
}

function baseUrlFromEvent(event: APIGatewayProxyEvent): string {
  const headers = lowerHeaders(event.headers);
  const host = headers['x-forwarded-host'] || headers.host;
  if (!host) return '';
  const proto = headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

function allowlistedBaseUrl(value: string): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    parsed.pathname = '';
    parsed.search = '';
    parsed.hash = '';

    const isCloudFront = parsed.protocol === 'https:' && parsed.hostname.endsWith('.cloudfront.net');
    const isLocalDemo =
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
      parsed.port === '8787';

    return isCloudFront || isLocalDemo ? parsed.toString().replace(/\/+$/, '') : null;
  } catch {
    return null;
  }
}

function normalizePrivateKey(value: string): `0x${string}` | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
  return /^0x[0-9a-fA-F]{64}$/.test(normalized) ? (normalized as `0x${string}`) : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
