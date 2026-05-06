"use strict";
/**
 * x402 on AWS Edge - Structured Logger for Payment Events
 *
 * Emits structured JSON log entries to CloudWatch Logs for payment
 * verification and settlement events. Uses `console.log(JSON.stringify(...))`
 * so that CloudWatch Logs Insights can query individual fields.
 *
 * When Lambda advanced logging is enabled (LogFormat: JSON), the runtime
 * automatically injects `timestamp`, `level`, and `requestId` into each
 * log entry and merges application JSON fields into the envelope.
 * Failure events use `console.error` (level: ERROR) so that Lambda's
 * ApplicationLogLevel filtering can surface them independently.
 *
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveActorType = deriveActorType;
exports.deriveBotCategory = deriveBotCategory;
exports.deriveBotOrganization = deriveBotOrganization;
exports.deriveBotName = deriveBotName;
exports.emitPassthrough = emitPassthrough;
exports.emitPaymentRequested = emitPaymentRequested;
exports.emitVerification = emitVerification;
exports.emitSettlement = emitSettlement;
const constants_1 = require("./constants");
// ---------------------------------------------------------------------------
// Bot header derivation
// ---------------------------------------------------------------------------
function deriveActorType(botHeaders) {
    return botHeaders[constants_1.Headers.WAF_ACTOR_TYPE] || constants_1.BotDefaults.ACTOR_TYPE;
}
function deriveBotCategory(botHeaders) {
    return botHeaders[constants_1.Headers.WAF_BOT_CATEGORY] || constants_1.BotDefaults.CATEGORY;
}
function deriveBotOrganization(botHeaders) {
    return botHeaders[constants_1.Headers.WAF_BOT_ORGANIZATION] || constants_1.BotDefaults.ORGANIZATION;
}
function deriveBotName(botHeaders) {
    return botHeaders[constants_1.Headers.WAF_BOT_NAME] || constants_1.BotDefaults.NAME;
}
// ---------------------------------------------------------------------------
// Shared base fields from a LogContext
// ---------------------------------------------------------------------------
function baseFields(ctx) {
    return {
        path: ctx.path,
        price: ctx.price,
        clientIp: ctx.clientIp,
        actorType: deriveActorType(ctx.botHeaders),
        botCategory: deriveBotCategory(ctx.botHeaders),
        botOrganization: deriveBotOrganization(ctx.botHeaders),
        botName: deriveBotName(ctx.botHeaders),
        network: ctx.network,
    };
}
// ---------------------------------------------------------------------------
// Combined build-and-emit helpers (one-liner call sites in handlers)
// ---------------------------------------------------------------------------
function emitPassthrough(path, clientIp, botHeaders) {
    const entry = {
        event: constants_1.EventType.PASSTHROUGH,
        path,
        clientIp,
        actorType: deriveActorType(botHeaders),
        botCategory: deriveBotCategory(botHeaders),
        botOrganization: deriveBotOrganization(botHeaders),
        botName: deriveBotName(botHeaders),
    };
    console.log(JSON.stringify(entry));
}
function emitPaymentRequested(ctx) {
    const entry = {
        event: constants_1.EventType.PAYMENT_REQUESTED,
        ...baseFields(ctx),
        transactionHash: null,
    };
    console.log(JSON.stringify(entry));
}
function emitVerification(ctx, result, error) {
    const entry = {
        event: constants_1.EventType.VERIFICATION,
        ...baseFields(ctx),
        matchedRoute: ctx.path,
        result,
        error,
        transactionHash: null,
    };
    const json = JSON.stringify(entry);
    if (result === 'failure') {
        console.error(json);
    }
    else {
        console.log(json);
    }
}
function emitSettlement(ctx, result, opts) {
    const entry = {
        event: constants_1.EventType.SETTLEMENT,
        ...baseFields(ctx),
        result,
        transactionHash: opts?.transactionHash ?? null,
        error: opts?.error ?? null,
    };
    const json = JSON.stringify(entry);
    if (result === 'failure') {
        console.error(json);
    }
    else {
        console.log(json);
    }
}
//# sourceMappingURL=logger.js.map