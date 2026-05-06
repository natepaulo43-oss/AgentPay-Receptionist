/**
 * CloudFront HTTP Adapter
 *
 * Translates between CloudFront event objects and the internal HTTP interface.
 * Provides functions to extract parsed requests from CloudFront events
 * and manipulate headers on requests and responses.
 *
 */
import type { CloudFrontRequest, CloudFrontResultResponse, CloudFrontRequestEvent } from 'aws-lambda';
import type { ParsedRequest } from './types';
/**
 * Extract a ParsedRequest from a CloudFront origin-request event.
 *
 * Parses the CloudFront event to produce a clean internal representation
 * including the request path, host, flattened headers, payment header
 * (X-PAYMENT or X-PAYMENT-SIGNATURE), WAF-injected route action header,
 * and all WAF bot headers (x-amzn-waf-*).
 *
 * @param event - CloudFront origin-request event
 * @returns Parsed request with extracted fields
 *
 */
export declare function extractRequest(event: CloudFrontRequestEvent): ParsedRequest;
/**
 * Attach a header to a CloudFront request.
 *
 * Adds or replaces a header on the CloudFront request object.
 * Header keys are stored in lowercase as per CloudFront convention.
 *
 * @param request - CloudFront request object to modify
 * @param key - Header name (will be lowercased for storage)
 * @param value - Header value
 *
 */
export declare function attachHeader(request: CloudFrontRequest, key: string, value: string): void;
/**
 * Remove a header from a CloudFront request.
 *
 * Deletes a header from the CloudFront request object by its
 * lowercase key name.
 *
 * @param request - CloudFront request object to modify
 * @param key - Header name to remove (will be lowercased for lookup)
 *
 */
export declare function removeHeader(request: CloudFrontRequest, key: string): void;
/**
 * Remove a header from a CloudFront result response.
 *
 * Deletes a header from the CloudFront response object by its
 * lowercase key name. Used to strip internal headers (like
 * x-x402-pending-settlement) before returning responses to clients.
 *
 * @param response - CloudFront result response object to modify
 * @param key - Header name to remove (will be lowercased for lookup)
 *
 */
export declare function removeResponseHeader(response: CloudFrontResultResponse, key: string): void;
//# sourceMappingURL=cloudfront-adapter.d.ts.map