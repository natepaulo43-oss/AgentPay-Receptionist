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
            'Same-day ceramic detail',
            'Interior deep clean',
            'Paint enhancement',
            'Fleet wash and detail',
        ],
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
        },
    };
}
//# sourceMappingURL=businessProfile.js.map