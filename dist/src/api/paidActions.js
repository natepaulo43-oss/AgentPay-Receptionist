"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleHoldSlot = handleHoldSlot;
exports.handlePaidStub = handlePaidStub;
const http_1 = require("@x402/core/http");
const config_1 = require("./config");
const http_2 = require("./http");
const storage_1 = require("./storage");
async function handleHoldSlot(event, origin) {
    const headers = (0, http_2.lowerHeaders)(event.headers);
    const body = (0, http_2.parseJsonBody)(event);
    const requestEvent = (0, storage_1.eventFor)((0, config_1.makeId)('act'), 'REQUEST_RECEIVED', 'POST /api/paid/hold-slot reached the business-action endpoint.');
    if (!hasVerifiedPayment(headers)) {
        storage_1.memory.events.unshift(requestEvent);
        const requiredEvent = (0, storage_1.eventFor)(requestEvent.actionId, 'PAYMENT_REQUIRED_402', '$0.50 USDC x402 payment required before slot capacity is reserved.', config_1.HOLD_SLOT_PRICE);
        storage_1.memory.events.unshift(requiredEvent);
        await Promise.all([
            (0, storage_1.safePersist)('PAYMENT_EVENT', requestEvent.eventId, requestEvent),
            (0, storage_1.safePersist)('PAYMENT_EVENT', requiredEvent.eventId, requiredEvent),
        ]);
        return paymentRequiredResponse(event, origin);
    }
    const timestamp = (0, config_1.nowIso)();
    const paidAction = {
        actionId: requestEvent.actionId,
        businessId: config_1.BUSINESS_ID,
        sessionId: (0, http_2.stringField)(body.sessionId, 'demo-session-agentpay'),
        type: 'hold_slot',
        amount: config_1.HOLD_SLOT_PRICE,
        currency: 'USDC',
        network: config_1.NETWORK,
        paymentStatus: paymentStatusFor(headers),
        createdAt: timestamp,
        updatedAt: timestamp,
    };
    const lead = {
        leadId: (0, config_1.makeId)('lead'),
        businessId: config_1.BUSINESS_ID,
        customerName: (0, http_2.stringField)(body.customerName, 'Demo Customer'),
        customerPhone: (0, http_2.stringField)(body.customerPhone, '(305) 555-0142'),
        request: (0, http_2.stringField)(body.request, 'Hold a same-day ceramic detail appointment.'),
        service: (0, http_2.stringField)(body.service, 'Same-day ceramic detail'),
        vehicle: (0, http_2.stringField)(body.vehicle, 'black Tesla Model Y'),
        appointmentTime: (0, http_2.stringField)(body.appointmentTime, config_1.APPOINTMENT_TIME),
        paidActionId: paidAction.actionId,
        status: 'paid_slot_held',
        transcriptSnippet: (0, http_2.stringField)(body.transcriptSnippet, 'Customer asked for a same-day ceramic detail and accepted a 4:30 PM paid priority hold.'),
        createdAt: timestamp,
    };
    const timeline = [
        requestEvent,
        (0, storage_1.eventFor)(paidAction.actionId, 'PAYMENT_REQUIRED_402', 'Previous unpaid attempt returned HTTP 402 with x402 payment requirements.', config_1.HOLD_SLOT_PRICE),
        (0, storage_1.eventFor)(paidAction.actionId, 'PAYMENT_SIGNATURE_RECEIVED', 'x402 payment signature was attached to the retried request.', config_1.HOLD_SLOT_PRICE),
        (0, storage_1.eventFor)(paidAction.actionId, 'PAYMENT_VERIFIED', 'Lambda@Edge verified the x402 payment with the facilitator.', config_1.HOLD_SLOT_PRICE),
        (0, storage_1.eventFor)(paidAction.actionId, 'ACTION_COMPLETED', 'Priority appointment hold was created by the origin API.', config_1.HOLD_SLOT_PRICE),
        (0, storage_1.eventFor)(paidAction.actionId, 'LEAD_CREATED', 'Paid lead appeared in the business dashboard.', config_1.HOLD_SLOT_PRICE),
    ];
    storage_1.memory.payments.unshift(paidAction);
    storage_1.memory.leads.unshift(lead);
    storage_1.memory.events.unshift(...timeline.slice().reverse());
    await Promise.all([
        (0, storage_1.safePersist)('PAYMENT', paidAction.actionId, paidAction),
        (0, storage_1.safePersist)('LEAD', lead.leadId, lead),
        ...timeline.map((timelineEvent) => (0, storage_1.safePersist)('PAYMENT_EVENT', timelineEvent.eventId, timelineEvent)),
    ]);
    return (0, http_2.json)(200, {
        success: true,
        action: 'hold_slot',
        bookingId: lead.leadId,
        businessName: config_1.BUSINESS_NAME,
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
async function handlePaidStub(event, origin, type) {
    const headers = (0, http_2.lowerHeaders)(event.headers);
    if (!hasVerifiedPayment(headers))
        return paymentRequiredResponse(event, origin);
    return (0, http_2.json)(202, {
        success: false,
        action: type,
        status: 'accepted_but_not_fully_implemented_for_mvp',
        message: 'The hackathon MVP fully implements hold_slot; this paid capability is configured for the product roadmap.',
    }, origin);
}
function paymentRequiredResponse(event, origin) {
    const host = event.headers.Host ?? event.headers.host ?? 'localhost';
    const resource = `https://${host}${event.path}`;
    const body = {
        x402Version: 2,
        resource: {
            url: resource,
            description: config_1.HOLD_SLOT_DESCRIPTION,
            mimeType: 'application/json',
        },
        accepts: [
            {
                scheme: 'exact',
                network: config_1.NETWORK,
                amount: config_1.HOLD_SLOT_AMOUNT_ATOMIC,
                asset: config_1.USDC_ASSET_ADDRESS,
                payTo: config_1.PAY_TO_ADDRESS,
                maxTimeoutSeconds: 300,
                extra: {
                    name: config_1.USDC_ASSET_NAME,
                    version: config_1.USDC_ASSET_VERSION,
                    assetSymbol: 'USDC',
                    businessName: config_1.BUSINESS_NAME,
                    action: 'hold_priority_slot',
                },
            },
        ],
        error: `HTTP 402 Payment Required. $0.50 USDC required. Network: ${config_1.NETWORK_LABEL}. Protocol: x402.`,
    };
    return (0, http_2.json)(402, body, origin, {
        'Payment-Required': (0, http_1.encodePaymentRequiredHeader)(body),
        'x-agentpay-payment-protocol': config_1.PAYMENT_PROTOCOL,
        'x-agentpay-network': config_1.NETWORK,
        'x-agentpay-price': config_1.HOLD_SLOT_PRICE,
    });
}
function hasVerifiedPayment(headers) {
    if (headers['x-x402-pending-settlement'] || headers['x-payment-response']) {
        return true;
    }
    if (!config_1.ALLOW_UNVERIFIED_PAYMENT_HEADERS) {
        return false;
    }
    return Boolean(headers['payment-signature'] ||
        headers['x-payment']);
}
function paymentStatusFor(headers) {
    if (headers['x-x402-pending-settlement'] || headers['x-payment-response'])
        return 'settled';
    if (config_1.ALLOW_UNVERIFIED_PAYMENT_HEADERS && (headers['payment-signature'] || headers['x-payment']))
        return 'verified';
    return 'simulated';
}
//# sourceMappingURL=paidActions.js.map