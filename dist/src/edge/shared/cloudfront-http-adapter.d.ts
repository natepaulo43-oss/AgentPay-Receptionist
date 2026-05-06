import type { CloudFrontRequest } from 'aws-lambda';
import type { HTTPAdapter } from '@x402/core/server';
export declare class CloudFrontHTTPAdapter implements HTTPAdapter {
    private readonly request;
    private readonly distributionDomain;
    constructor(request: CloudFrontRequest, distributionDomain: string);
    getHeader(name: string): string | undefined;
    getMethod(): string;
    getPath(): string;
    getUrl(): string;
    getAcceptHeader(): string;
    getUserAgent(): string;
    getQueryParams(): Record<string, string | string[]>;
}
//# sourceMappingURL=cloudfront-http-adapter.d.ts.map