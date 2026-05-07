"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const businessProfile_1 = require("./businessProfile");
const chat_1 = require("./chat");
const config_1 = require("./config");
const demoBuyer_1 = require("./demoBuyer");
const http_1 = require("./http");
const paidActions_1 = require("./paidActions");
const storage_1 = require("./storage");
async function route(event, origin) {
    const path = event.path.replace(/\/+$/, '') || '/';
    const method = event.httpMethod.toUpperCase();
    if (method === 'OPTIONS') {
        return (0, http_1.json)(204, {}, origin);
    }
    if (path === '/api/health' && method === 'GET') {
        return (0, http_1.json)(200, {
            ok: true,
            service: 'AgentPay Receptionist API',
            businessName: config_1.BUSINESS_NAME,
            network: config_1.NETWORK,
            protocol: config_1.PAYMENT_PROTOCOL,
            storage: config_1.TABLE_NAME ? 'dynamodb' : 'mock-memory',
            timestamp: (0, config_1.nowIso)(),
        }, origin);
    }
    if (path === '/api/agent/business-profile' && method === 'GET') {
        return (0, http_1.json)(200, (0, businessProfile_1.businessProfile)(), origin);
    }
    if (path === '/api/chat' && method === 'POST') {
        if (!(0, chat_1.enforceChatRateLimit)(event)) {
            return (0, http_1.json)(429, { error: 'Too many chat requests. Please wait a moment and try again.' }, origin);
        }
        const body = (0, http_1.parseJsonBody)(event);
        const message = (0, http_1.stringField)(body.message, (0, http_1.stringField)(body.textFromUser));
        if (!message) {
            return (0, http_1.json)(400, { error: 'message is required.' }, origin);
        }
        return (0, http_1.json)(200, (0, chat_1.chatResponseFor)({
            message,
            conversationHistory: (0, chat_1.parseConversationHistory)(body.conversationHistory),
        }), origin);
    }
    if (path === '/api/demo/agent-buyer' && method === 'POST') {
        return (0, demoBuyer_1.handleDemoAgentBuyer)(event, origin);
    }
    if (path === '/api/paid/hold-slot' && method === 'POST') {
        return (0, paidActions_1.handleHoldSlot)(event, origin);
    }
    if (path === '/api/paid/quote-request' && method === 'POST') {
        return (0, paidActions_1.handlePaidStub)(event, origin, 'quote_request');
    }
    if (path === '/api/paid/priority-callback' && method === 'POST') {
        return (0, paidActions_1.handlePaidStub)(event, origin, 'priority_callback');
    }
    if (path === '/api/dashboard/leads' && method === 'GET') {
        const leads = await (0, storage_1.getStoredLeads)();
        return (0, http_1.json)(200, { businessName: config_1.BUSINESS_NAME, leads }, origin);
    }
    if (path === '/api/dashboard/payments' && method === 'GET') {
        const payments = await (0, storage_1.getStoredPayments)();
        return (0, http_1.json)(200, { businessName: config_1.BUSINESS_NAME, ...payments }, origin);
    }
    if (path === '/api/dashboard/reset' && method === 'POST') {
        const reset = await (0, storage_1.resetStoredData)();
        return (0, http_1.json)(200, {
            success: true,
            businessName: config_1.BUSINESS_NAME,
            message: 'Demo data reset for a clean judging run.',
            ...reset,
        }, origin);
    }
    return (0, http_1.json)(404, { error: 'Not found', path, method }, origin);
}
const handler = async (event) => {
    const headers = (0, http_1.lowerHeaders)(event.headers);
    const origin = headers.origin;
    if (!(0, http_1.isAllowedOrigin)(origin) && !['GET', 'HEAD', 'OPTIONS'].includes(event.httpMethod.toUpperCase())) {
        return (0, http_1.json)(403, { error: 'Forbidden - Invalid origin' }, origin);
    }
    try {
        return await route(event, origin);
    }
    catch (error) {
        if (error instanceof SyntaxError) {
            return (0, http_1.json)(400, { error: 'Invalid JSON body.' }, origin);
        }
        if (error instanceof Error && error.name === 'PayloadTooLarge') {
            return (0, http_1.json)(413, { error: error.message }, origin);
        }
        console.error('AgentPay API error', error);
        return (0, http_1.json)(500, { error: 'Internal server error.' }, origin);
    }
};
exports.handler = handler;
//# sourceMappingURL=handler.js.map