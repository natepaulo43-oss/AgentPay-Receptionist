#!/usr/bin/env node
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from '@x402/fetch';
import { ExactEvmScheme, toClientEvmSigner } from '@x402/evm';
import { privateKeyToAccount } from 'viem/accounts';

const baseUrl = trimTrailingSlash(process.env.AGENTPAY_BASE_URL || 'http://127.0.0.1:8787');
const privateKey = normalizePrivateKey(process.env.X402_BUYER_PRIVATE_KEY);

if (!privateKey) {
  console.error('Missing X402_BUYER_PRIVATE_KEY. Use a funded Base Sepolia test wallet for live settlement.');
  console.error('Example: X402_BUYER_PRIVATE_KEY=0x... AGENTPAY_BASE_URL=https://<cloudfront-domain> npm run agent:pay');
  process.exit(1);
}

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

const payload = {
  sessionId: 'agent-cli-x402-buyer',
  customerName: 'Autonomous Agent',
  customerPhone: '(305) 555-0142',
  vehicle: 'black Tesla Model Y',
  service: 'Same-day ceramic detail',
  request: 'Hold a same-day ceramic detail appointment at 4:30 PM.',
  appointmentTime: '2026-05-05T16:30:00-04:00',
  transcriptSnippet: 'Agent CLI buyer discovered the paid capability, received HTTP 402, paid with x402, and booked the hold.',
};

const holdSlotUrl = `${baseUrl}/api/paid/hold-slot`;

console.log(`Discovering business profile at ${baseUrl}/api/agent/business-profile`);
const profileResponse = await fetch(`${baseUrl}/api/agent/business-profile`);
const profile = await profileResponse.json();
console.log(JSON.stringify({
  businessName: profile.name,
  paidCapabilities: profile.paidCapabilities,
}, null, 2));

console.log(`\nAttempting unpaid action at ${holdSlotUrl}`);
const unpaidResponse = await fetch(holdSlotUrl, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
});
const unpaidBody = await unpaidResponse.json();
console.log(JSON.stringify({
  status: unpaidResponse.status,
  body: unpaidBody,
}, null, 2));

console.log('\nRetrying with @x402/fetch payment handling');
const paidResponse = await fetchWithPayment(holdSlotUrl, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
});
const paidBody = await paidResponse.json();
const paymentResponseHeader = paidResponse.headers.get('x-payment-response');
const decodedPaymentResponse = paymentResponseHeader
  ? decodePaymentResponseHeader(paymentResponseHeader)
  : null;

console.log(JSON.stringify({
  status: paidResponse.status,
  paymentResponse: decodedPaymentResponse,
  body: paidBody,
}, null, 2));

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function normalizePrivateKey(value) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
}
