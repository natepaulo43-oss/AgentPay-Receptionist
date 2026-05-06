"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.businessProfile = businessProfile;
const config_1 = require("./config");
function businessProfile() {
    return {
        businessId: config_1.BUSINESS_ID,
        name: config_1.BUSINESS_NAME,
        industry: 'Mobile and studio auto detailing',
        serviceArea: 'Miami, Brickell, Wynwood, Coral Gables, Miami Beach',
        hours: 'Mon-Sat 8:00 AM-6:00 PM ET',
        services: [
            {
                name: 'Same-day ceramic detail',
                category: 'appointment',
                typicalPriceRange: '$280-$450',
                requiredQualifiers: ['vehicle', 'location', 'preferred time'],
            },
            {
                name: 'Interior deep clean',
                category: 'appointment',
                typicalPriceRange: '$160-$260',
                requiredQualifiers: ['vehicle', 'condition', 'location'],
            },
            {
                name: 'Paint enhancement',
                category: 'quote',
                typicalPriceRange: '$350-$650',
                requiredQualifiers: ['vehicle', 'paint condition', 'photos'],
            },
            {
                name: 'Fleet wash and detail',
                category: 'quote',
                typicalPriceRange: 'custom quote',
                requiredQualifiers: ['vehicle count', 'cadence', 'location'],
            },
        ],
        agentInstructions: [
            'Use free endpoints for discovery and normal questions.',
            'Do not pay for informational answers.',
            'Use paid endpoints only when creating business value: reserved capacity, verified quote intake, or priority callback.',
            'For hold_priority_slot, first expect HTTP 402 Payment Required, then retry with x402 payment.',
        ],
        demoScenario: {
            customerGoal: 'Hold a same-day ceramic detail appointment for a black Tesla Model Y in Miami.',
            recommendedAction: 'hold_priority_slot',
            appointmentTime: '2026-05-05T16:30:00-04:00',
            expectedPayment: {
                amount: '5.00',
                currency: 'USDC',
                network: config_1.NETWORK,
                protocol: config_1.PAYMENT_PROTOCOL,
            },
        },
        freeCapabilities: [
            {
                action: 'answer_questions',
                endpoint: '/api/chat',
                method: 'POST',
                description: 'Ask free questions and qualify the service request.',
            },
            {
                action: 'discover_business_profile',
                endpoint: '/api/agent/business-profile',
                method: 'GET',
                description: 'Machine-readable business profile and capability catalog.',
            },
        ],
        paidCapabilities: [
            {
                action: 'hold_priority_slot',
                endpoint: '/api/paid/hold-slot',
                method: 'POST',
                price: '$5.00',
                currency: 'USDC',
                network: config_1.NETWORK,
                networkName: config_1.NETWORK_LABEL,
                protocol: config_1.PAYMENT_PROTOCOL,
                description: config_1.HOLD_SLOT_DESCRIPTION,
                inputSchema: {
                    type: 'object',
                    required: ['customerName', 'customerPhone', 'vehicle', 'service', 'appointmentTime'],
                    properties: {
                        customerName: { type: 'string' },
                        customerPhone: { type: 'string' },
                        vehicle: { type: 'string' },
                        service: { type: 'string' },
                        appointmentTime: { type: 'string', format: 'date-time' },
                        transcriptSnippet: { type: 'string' },
                    },
                },
                successSchema: {
                    type: 'object',
                    required: ['success', 'bookingId', 'amountPaid', 'currency', 'network', 'paymentStatus'],
                },
            },
            {
                action: 'submit_verified_quote_request',
                endpoint: '/api/paid/quote-request',
                method: 'POST',
                price: '$1.00',
                currency: 'USDC',
                network: config_1.NETWORK,
                networkName: config_1.NETWORK_LABEL,
                protocol: config_1.PAYMENT_PROTOCOL,
            },
            {
                action: 'priority_callback',
                endpoint: '/api/paid/priority-callback',
                method: 'POST',
                price: '$2.00',
                currency: 'USDC',
                network: config_1.NETWORK,
                networkName: config_1.NETWORK_LABEL,
                protocol: config_1.PAYMENT_PROTOCOL,
            },
        ],
        payment: {
            scheme: 'exact',
            protocol: config_1.PAYMENT_PROTOCOL,
            defaultNetwork: config_1.NETWORK,
            defaultNetworkName: config_1.NETWORK_LABEL,
            payTo: config_1.PAY_TO_ADDRESS,
            facilitator: process.env.X402_FACILITATOR_URL ?? 'https://x402.org/facilitator',
            productionFacilitator: 'Coinbase Developer Platform x402 Facilitator',
            protectedRoutePattern: '/api/paid/**',
            protectedDemoRoute: 'POST /api/paid/hold-slot',
        },
    };
}
//# sourceMappingURL=businessProfile.js.map