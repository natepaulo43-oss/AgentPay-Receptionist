/**
 * x402 Middleware Factory
 *
 * Creates x402 middleware functions for Lambda@Edge, following the upstream
 * cloudfront-lambda-edge example pattern. The server instance is cached
 * per Lambda container so initialize() only runs once.
 *
 * @see https://github.com/coinbase/x402/tree/main/examples/typescript/servers/cloudfront-lambda-edge
 */
import type { CloudFrontRequest, CloudFrontResultResponse } from 'aws-lambda';
import type { HTTPResponseInstructions } from '@x402/core/server';
import { type X402ServerConfig } from './x402-server';
import { RequestResultType, ResponseResultType } from './constants';
export interface OriginRequestResult {
    type: typeof RequestResultType.PASS_THROUGH | typeof RequestResultType.PAYMENT_ERROR;
    response?: HTTPResponseInstructions;
    paymentPayload?: unknown;
    paymentRequirements?: unknown;
}
export interface OriginResponseResult {
    type: typeof ResponseResultType.PASS_THROUGH | typeof ResponseResultType.SETTLED | typeof ResponseResultType.SETTLEMENT_FAILED;
    response: CloudFrontResultResponse;
    error?: string;
    transactionHash?: string | null;
}
export declare function createX402Middleware(config: X402ServerConfig): {
    processOriginRequest(request: CloudFrontRequest, distributionDomain: string): Promise<OriginRequestResult>;
    processOriginResponse(request: CloudFrontRequest, response: CloudFrontResultResponse): Promise<OriginResponseResult>;
};
//# sourceMappingURL=x402-middleware.d.ts.map