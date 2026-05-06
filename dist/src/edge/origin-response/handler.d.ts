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
import type { CloudFrontResponseEvent, CloudFrontResponseResult } from 'aws-lambda';
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
export declare const handler: (event: CloudFrontResponseEvent) => Promise<CloudFrontResponseResult>;
//# sourceMappingURL=handler.d.ts.map