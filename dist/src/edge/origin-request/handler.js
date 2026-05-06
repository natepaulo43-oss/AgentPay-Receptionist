"use strict";
/**
 * Origin Request Lambda@Edge Handler
 *
 * Entry point for the CloudFront origin-request trigger. This handler:
 * 1. Reads the WAF-injected `x-x402-route-action` header
 * 2. If header absent or value is "0" → passes through to origin (no payment required)
 * 3. If header contains a valid price → proceeds to payment flow:
 *    - Load EdgeConfig via config loader (PayTo, Network)
 *    - Construct a dynamic RoutesConfig from WAF price + SSM config
 *    - Delegate to x402 middleware for payment verification
 *    - On pass-through → forward request to origin
 *    - On payment-error → return 402 via toLambdaResponse
 * 4. Log verification event via structured logger
 *
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const cloudfront_adapter_1 = require("../shared/cloudfront-adapter");
const config_loader_1 = require("../shared/config-loader");
const cdp_auth_1 = require("../shared/cdp-auth");
const logger_1 = require("../shared/logger");
const x402_middleware_1 = require("../shared/x402-middleware");
const to_lambda_response_1 = require("../shared/to-lambda-response");
const constants_1 = require("../shared/constants");
/**
 * Extract client IP from CloudFront request headers.
 */
function extractClientIp(headers) {
    const forwardedFor = headers[constants_1.Headers.FORWARDED_FOR];
    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
    }
    return constants_1.RouteDefaults.UNKNOWN_CLIENT;
}
/**
 * Origin Request Lambda@Edge handler.
 *
 * WAF is the single source of truth for route resolution — this handler only
 * reads the WAF-injected price header and drives the payment flow via the
 * x402 middleware (following the upstream cloudfront-lambda-edge pattern).
 *
 */
const handler = async (event) => {
    const request = event.Records[0].cf.request;
    const parsedRequest = (0, cloudfront_adapter_1.extractRequest)(event);
    const routeActionHeader = parsedRequest.routeActionHeader;
    // Security: Always strip client-supplied pending settlement header
    (0, cloudfront_adapter_1.removeHeader)(request, constants_1.Headers.PENDING_SETTLEMENT);
    // If header is absent or "0" → pass through (no payment required)
    if (!routeActionHeader || routeActionHeader === constants_1.RouteDefaults.FREE_PRICE) {
        (0, logger_1.emitPassthrough)(parsedRequest.path, extractClientIp(parsedRequest.headers), parsedRequest.botHeaders);
        return request;
    }
    // Validate that the route action header contains a valid price
    const price = parseFloat(routeActionHeader);
    if (isNaN(price) || price < 0 || price > Number.MAX_SAFE_INTEGER) {
        console.warn(`Invalid ${constants_1.Headers.WAF_ROUTE_ACTION} header value: ${routeActionHeader}. Passing through to origin.`);
        return request;
    }
    // Load EdgeConfig from SSM Parameter Store (with TTL caching)
    const edgeConfig = await (0, config_loader_1.getEdgeConfig)();
    // Construct dynamic RoutesConfig from WAF price + SSM config
    const routeKey = `${request.method} ${constants_1.RouteDefaults.CATCH_ALL_PATH}`;
    const routes = {
        [routeKey]: {
            accepts: {
                scheme: 'exact',
                payTo: edgeConfig.payTo,
                price: parseFloat(routeActionHeader),
                network: edgeConfig.network,
                description: constants_1.RouteDefaults.BUSINESS_ACTION_DESCRIPTION,
            },
        },
    };
    // Create middleware following upstream pattern — config at construction,
    // server instance cached per Lambda container via serverPromise.
    // Routes are dynamic (WAF price varies per request), so middleware is
    // constructed per-request, but the facilitator handshake is cached.
    const middleware = (0, x402_middleware_1.createX402Middleware)({
        facilitatorUrl: edgeConfig.facilitatorUrl,
        network: edgeConfig.network,
        routes,
        facilitatorConfig: edgeConfig.cdpCredentials
            ? (0, cdp_auth_1.createCdpFacilitatorConfig)(edgeConfig.cdpCredentials.apiKeyName, edgeConfig.cdpCredentials.apiKeyPrivateKey)
            : undefined,
    });
    const logCtx = {
        path: parsedRequest.path,
        price: routeActionHeader,
        clientIp: extractClientIp(parsedRequest.headers),
        botHeaders: parsedRequest.botHeaders,
        network: edgeConfig.network,
    };
    // Delegate to x402 middleware for payment verification
    const result = await middleware.processOriginRequest(request, parsedRequest.host);
    const paymentVerified = result.type === 'pass-through' && result.paymentPayload !== undefined;
    const isPaymentError = result.type === 'payment-error';
    const hasPaymentHeader = !!parsedRequest.paymentHeader;
    if (isPaymentError && !hasPaymentHeader) {
        (0, logger_1.emitPaymentRequested)(logCtx);
    }
    if (isPaymentError && hasPaymentHeader) {
        (0, logger_1.emitVerification)(logCtx, 'failure', 'Payment verification rejected by facilitator');
    }
    if (paymentVerified) {
        (0, logger_1.emitVerification)(logCtx, 'success', null);
    }
    // On payment-error → return 402 response
    if (result.type === 'payment-error') {
        return (0, to_lambda_response_1.toLambdaResponse)(result.response);
    }
    // Pass through to origin
    return request;
};
exports.handler = handler;
//# sourceMappingURL=handler.js.map