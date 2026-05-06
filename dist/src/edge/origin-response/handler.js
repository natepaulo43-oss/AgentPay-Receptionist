"use strict";
/**
 * Origin Response Lambda@Edge Handler
 *
 * Entry point for the CloudFront origin-response trigger. This handler:
 * 1. Checks for `x-x402-pending-settlement` header in the request
 * 2. Removes the settlement header from the response (client-facing cleanup)
 * 3. If not present → passes through response unchanged
 * 4. If present + origin status >= 400 → skips settlement, logs failure
 * 5. If present + origin status < 400 → delegates to x402 middleware for settlement
 * 6. Logs settlement result via structured logger
 *
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const cloudfront_adapter_1 = require("../shared/cloudfront-adapter");
const config_loader_1 = require("../shared/config-loader");
const cdp_auth_1 = require("../shared/cdp-auth");
const logger_1 = require("../shared/logger");
const x402_middleware_1 = require("../shared/x402-middleware");
const constants_1 = require("../shared/constants");
/**
 * Extract the value of a header from CloudFront request headers.
 *
 * @param headers - CloudFront request headers (multi-value format)
 * @param key - Header name (will be lowercased for lookup)
 * @returns Header value or undefined if not present
 */
function getRequestHeader(headers, key) {
    const lowerKey = key.toLowerCase();
    const values = headers[lowerKey];
    if (values && values.length > 0) {
        return values[0].value;
    }
    return undefined;
}
/**
 * Extract bot headers from CloudFront request headers.
 * Bot headers are those matching the `x-amzn-waf-*` pattern.
 *
 * @param headers - CloudFront request headers (multi-value format)
 * @returns Map of bot header keys to values
 */
function extractBotHeaders(headers) {
    const botHeaders = {};
    for (const [key, values] of Object.entries(headers)) {
        if (key.toLowerCase().startsWith(constants_1.Headers.WAF_PREFIX) && values && values.length > 0) {
            botHeaders[key.toLowerCase()] = values[0].value;
        }
    }
    return botHeaders;
}
/**
 * Extract client IP from CloudFront request headers.
 * CloudFront adds the client IP in the x-forwarded-for header.
 *
 * @param headers - CloudFront request headers (multi-value format)
 * @returns Client IP address or "[unknown]" if not available
 */
function extractClientIp(headers) {
    const forwardedFor = getRequestHeader(headers, constants_1.Headers.FORWARDED_FOR);
    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
    }
    return constants_1.RouteDefaults.UNKNOWN_CLIENT;
}
/**
 * Extract the price from the WAF-injected route action header.
 *
 * @param headers - CloudFront request headers (multi-value format)
 * @returns Price string or "0" if not available
 */
function extractPrice(headers) {
    const routeAction = getRequestHeader(headers, constants_1.Headers.WAF_ROUTE_ACTION);
    return routeAction ?? constants_1.RouteDefaults.FREE_PRICE;
}
/**
 * Origin Response Lambda@Edge handler.
 *
 * Processes CloudFront origin responses to settle payments when the origin
 * returns a successful response. Settlement is only attempted when:
 * - The request contains an `x-x402-pending-settlement` header (set by origin-request)
 * - The origin response status code is less than 400
 *
 * Uses the x402 middleware for settlement instead of direct facilitator calls.
 * The `x-x402-pending-settlement` header is always removed from the response
 * before returning to the client, regardless of settlement outcome.
 *
 * @param event - CloudFront origin-response event
 * @returns CloudFront response (with settlement header removed)
 *
 */
const handler = async (event) => {
    const response = event.Records[0].cf.response;
    const request = event.Records[0].cf.request;
    // Step 1: Check for x-x402-pending-settlement header in the REQUEST
    const settlementData = getRequestHeader(request.headers, constants_1.Headers.PENDING_SETTLEMENT);
    // Step 2: Always remove the settlement header from the RESPONSE before returning to client
    (0, cloudfront_adapter_1.removeResponseHeader)(response, constants_1.Headers.PENDING_SETTLEMENT);
    // Step 3: If no settlement header in request → pass through response unchanged
    if (!settlementData) {
        return response;
    }
    // Step 4: Check origin response status code
    const statusCode = parseInt(response.status, 10);
    const logCtx = {
        path: request.uri,
        price: extractPrice(request.headers),
        clientIp: extractClientIp(request.headers),
        botHeaders: extractBotHeaders(request.headers),
        network: '',
    };
    // Step 5: If origin status >= 400 → skip settlement, return error response
    if (statusCode >= constants_1.HttpStatus.ERROR_THRESHOLD) {
        (0, logger_1.emitSettlement)(logCtx, 'failure', { error: `Settlement skipped: origin returned status ${statusCode}` });
        return response;
    }
    // Step 6: Origin status < 400 → delegate to x402 middleware for settlement
    try {
        const edgeConfig = await (0, config_loader_1.getEdgeConfig)();
        const routeKey = `${request.method} ${constants_1.RouteDefaults.CATCH_ALL_PATH}`;
        const routes = {
            [routeKey]: {
                accepts: {
                    scheme: 'exact',
                    payTo: edgeConfig.payTo,
                    price: parseFloat(logCtx.price),
                    network: edgeConfig.network,
                    description: constants_1.RouteDefaults.BUSINESS_ACTION_DESCRIPTION,
                },
            },
        };
        const middleware = (0, x402_middleware_1.createX402Middleware)({
            facilitatorUrl: edgeConfig.facilitatorUrl,
            network: edgeConfig.network,
            routes,
            facilitatorConfig: edgeConfig.cdpCredentials
                ? (0, cdp_auth_1.createCdpFacilitatorConfig)(edgeConfig.cdpCredentials.apiKeyName, edgeConfig.cdpCredentials.apiKeyPrivateKey)
                : undefined,
        });
        const settleResult = await middleware.processOriginResponse(request, response);
        logCtx.network = edgeConfig.network;
        switch (settleResult.type) {
            case constants_1.ResponseResultType.SETTLED:
                (0, logger_1.emitSettlement)(logCtx, 'success', { transactionHash: settleResult.transactionHash });
                break;
            case constants_1.ResponseResultType.SETTLEMENT_FAILED:
                (0, logger_1.emitSettlement)(logCtx, 'failure', { error: settleResult.error ?? 'Settlement failed' });
                break;
            case constants_1.ResponseResultType.PASS_THROUGH:
                break;
        }
        return settleResult.response;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        (0, logger_1.emitSettlement)(logCtx, 'failure', { error: `Settlement error: ${errorMessage}` });
    }
    // Return the origin response (with settlement header already removed)
    return response;
};
exports.handler = handler;
//# sourceMappingURL=handler.js.map