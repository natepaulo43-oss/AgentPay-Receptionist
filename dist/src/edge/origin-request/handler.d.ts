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
import type { CloudFrontRequestEvent, CloudFrontRequestResult } from 'aws-lambda';
/**
 * Origin Request Lambda@Edge handler.
 *
 * WAF is the single source of truth for route resolution — this handler only
 * reads the WAF-injected price header and drives the payment flow via the
 * x402 middleware (following the upstream cloudfront-lambda-edge pattern).
 *
 */
export declare const handler: (event: CloudFrontRequestEvent) => Promise<CloudFrontRequestResult>;
//# sourceMappingURL=handler.d.ts.map