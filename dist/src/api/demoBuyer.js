"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDemoAgentBuyer = handleDemoAgentBuyer;
const evm_1 = require("@x402/evm");
const fetch_1 = require("@x402/fetch");
const accounts_1 = require("viem/accounts");
const config_1 = require("./config");
const http_1 = require("./http");
const DEMO_BUYER_PAYLOAD = {
    sessionId: 'agent-web-x402-buyer',
    customerName: 'Autonomous Agent',
    customerPhone: '(305) 555-0142',
    vehicle: 'black Tesla Model Y',
    service: 'Same-day ceramic detail',
    request: 'Hold a same-day ceramic detail appointment at 4:30 PM.',
    appointmentTime: config_1.APPOINTMENT_TIME,
    transcriptSnippet: 'Website demo buyer discovered the paid capability, received HTTP 402, paid with x402, and booked the hold.',
};
async function handleDemoAgentBuyer(event, origin) {
    const privateKey = normalizePrivateKey(config_1.DEMO_BUYER_PRIVATE_KEY);
    if (!privateKey) {
        return (0, http_1.json)(503, {
            success: false,
            configured: false,
            error: 'DEMO_BUYER_PRIVATE_KEY is not configured for the server-side demo buyer.',
            nextStep: 'Deploy once with DemoBuyerPrivateKey set to a funded Base Sepolia test wallet, then this button can run without terminal commands.',
        }, origin);
    }
    const body = (0, http_1.parseJsonBody)(event);
    const baseUrl = resolveBaseUrl(event, body);
    if (!baseUrl) {
        return (0, http_1.json)(400, {
            success: false,
            error: 'A valid AgentPay baseUrl is required.',
            allowedExamples: [
                'https://d2pc20oig2383p.cloudfront.net',
                'https://your-cloudfront-domain.cloudfront.net',
            ],
        }, origin);
    }
    try {
        const account = (0, accounts_1.privateKeyToAccount)(privateKey);
        const signer = (0, evm_1.toClientEvmSigner)(account);
        const fetchWithPayment = (0, fetch_1.wrapFetchWithPaymentFromConfig)(fetch, {
            schemes: [
                {
                    network: 'eip155:*',
                    client: new evm_1.ExactEvmScheme(signer),
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
            return (0, http_1.json)(502, {
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
            ? paid.body
            : {};
        return (0, http_1.json)(paid.ok ? 200 : 502, {
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
    }
    catch (error) {
        return (0, http_1.json)(502, {
            success: false,
            configured: true,
            stage: 'SERVER_SIDE_DEMO_BUYER',
            error: error instanceof Error ? error.message : String(error),
        }, origin);
    }
}
async function fetchJson(url, options = {}) {
    const { fetcher = fetch, ...init } = options;
    const response = await fetcher(url, init);
    const text = await response.text();
    let body = null;
    try {
        body = text ? JSON.parse(text) : null;
    }
    catch {
        body = { raw: text };
    }
    const paymentResponseHeader = response.headers.get('x-payment-response');
    let paymentResponse = null;
    if (paymentResponseHeader) {
        try {
            paymentResponse = (0, fetch_1.decodePaymentResponseHeader)(paymentResponseHeader);
        }
        catch {
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
function resolveBaseUrl(event, body) {
    const requested = (0, http_1.stringField)(body.baseUrl, config_1.AGENTPAY_PUBLIC_BASE_URL);
    const candidate = requested || baseUrlFromEvent(event);
    return allowlistedBaseUrl(candidate);
}
function baseUrlFromEvent(event) {
    const headers = (0, http_1.lowerHeaders)(event.headers);
    const host = headers['x-forwarded-host'] || headers.host;
    if (!host)
        return '';
    const proto = headers['x-forwarded-proto'] || 'https';
    return `${proto}://${host}`;
}
function allowlistedBaseUrl(value) {
    if (!value)
        return null;
    try {
        const parsed = new URL(value);
        parsed.pathname = '';
        parsed.search = '';
        parsed.hash = '';
        const isCloudFront = parsed.protocol === 'https:' && parsed.hostname.endsWith('.cloudfront.net');
        const isLocalDemo = parsed.protocol === 'http:' &&
            (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
            parsed.port === '8787';
        return isCloudFront || isLocalDemo ? parsed.toString().replace(/\/+$/, '') : null;
    }
    catch {
        return null;
    }
}
function normalizePrivateKey(value) {
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    const normalized = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
    return /^0x[0-9a-fA-F]{64}$/.test(normalized) ? normalized : null;
}
function stringValue(value) {
    return typeof value === 'string' ? value : null;
}
//# sourceMappingURL=demoBuyer.js.map