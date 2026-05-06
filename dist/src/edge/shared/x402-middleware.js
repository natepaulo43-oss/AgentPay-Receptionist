"use strict";
/**
 * x402 Middleware Factory
 *
 * Creates x402 middleware functions for Lambda@Edge, following the upstream
 * cloudfront-lambda-edge example pattern. The server instance is cached
 * per Lambda container so initialize() only runs once.
 *
 * @see https://github.com/coinbase/x402/tree/main/examples/typescript/servers/cloudfront-lambda-edge
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createX402Middleware = createX402Middleware;
const cloudfront_http_adapter_1 = require("./cloudfront-http-adapter");
const x402_server_1 = require("./x402-server");
const cloudfront_adapter_1 = require("./cloudfront-adapter");
const constants_1 = require("./constants");
function createX402Middleware(config) {
    // Cache the server promise so initialize() runs once per Lambda container
    let serverPromise = null;
    const getServer = async () => {
        if (!serverPromise) {
            serverPromise = (0, x402_server_1.createX402Server)(config);
        }
        return serverPromise;
    };
    return {
        async processOriginRequest(request, distributionDomain) {
            // Strip pending settlement header for security
            (0, cloudfront_adapter_1.removeHeader)(request, constants_1.Headers.PENDING_SETTLEMENT);
            const server = await getServer();
            const adapter = new cloudfront_http_adapter_1.CloudFrontHTTPAdapter(request, distributionDomain);
            const context = {
                adapter,
                path: adapter.getPath(),
                method: adapter.getMethod(),
                paymentHeader: adapter.getHeader(constants_1.Headers.PAYMENT_SIGNATURE),
            };
            const result = await server.processHTTPRequest(context);
            switch (result.type) {
                case 'no-payment-required':
                    return { type: constants_1.RequestResultType.PASS_THROUGH };
                case 'payment-verified': {
                    const pendingData = JSON.stringify({
                        payload: result.paymentPayload,
                        requirements: result.paymentRequirements,
                    });
                    const encoded = Buffer.from(pendingData).toString('base64');
                    (0, cloudfront_adapter_1.attachHeader)(request, constants_1.Headers.PENDING_SETTLEMENT, encoded);
                    return {
                        type: constants_1.RequestResultType.PASS_THROUGH,
                        paymentPayload: result.paymentPayload,
                        paymentRequirements: result.paymentRequirements,
                    };
                }
                case 'payment-error':
                    return {
                        type: constants_1.RequestResultType.PAYMENT_ERROR,
                        response: result.response,
                    };
            }
        },
        async processOriginResponse(request, response) {
            // Read pending settlement header from request
            const pendingHeader = request.headers[constants_1.Headers.PENDING_SETTLEMENT]?.[0]?.value;
            // If absent: return response unchanged
            if (!pendingHeader) {
                return { type: constants_1.ResponseResultType.PASS_THROUGH, response };
            }
            // If origin status >= 400: skip settlement
            const statusCode = parseInt(response.status, 10);
            if (statusCode >= constants_1.HttpStatus.ERROR_THRESHOLD) {
                return { type: constants_1.ResponseResultType.PASS_THROUGH, response };
            }
            // Decode base64 JSON pending settlement data
            const decoded = JSON.parse(Buffer.from(pendingHeader, 'base64').toString('utf-8'));
            // Settle payment
            const server = await getServer();
            const settleResult = await server.processSettlement(decoded.payload, decoded.requirements);
            if (settleResult.success) {
                // Add settlement headers to response
                if (!response.headers) {
                    response.headers = {};
                }
                for (const [key, value] of Object.entries(settleResult.headers)) {
                    response.headers[key.toLowerCase()] = [{ key, value }];
                }
                // Extract transaction hash from settlement response headers
                const transactionHash = settleResult.headers[constants_1.Headers.PAYMENT_RESPONSE]
                    ? (() => {
                        try {
                            const parsed = JSON.parse(settleResult.headers[constants_1.Headers.PAYMENT_RESPONSE]);
                            return parsed.transaction ?? parsed.transactionHash ?? null;
                        }
                        catch {
                            return null;
                        }
                    })()
                    : null;
                return { type: constants_1.ResponseResultType.SETTLED, response, transactionHash };
            }
            // Settlement failed — return error details
            return {
                type: constants_1.ResponseResultType.SETTLEMENT_FAILED,
                response,
                error: settleResult.errorReason,
            };
        },
    };
}
//# sourceMappingURL=x402-middleware.js.map