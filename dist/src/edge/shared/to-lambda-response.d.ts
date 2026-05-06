import type { CloudFrontResultResponse } from 'aws-lambda';
export declare function toLambdaResponse(instructions: {
    status: number;
    headers: Record<string, string>;
    body?: unknown;
}): CloudFrontResultResponse;
//# sourceMappingURL=to-lambda-response.d.ts.map