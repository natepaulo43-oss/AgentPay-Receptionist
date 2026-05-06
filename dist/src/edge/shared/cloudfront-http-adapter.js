"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudFrontHTTPAdapter = void 0;
const constants_1 = require("./constants");
class CloudFrontHTTPAdapter {
    request;
    distributionDomain;
    constructor(request, distributionDomain) {
        this.request = request;
        this.distributionDomain = distributionDomain;
    }
    getHeader(name) {
        const lowerName = name.toLowerCase();
        const values = this.request.headers[lowerName];
        return values?.[0]?.value;
    }
    getMethod() {
        return this.request.method;
    }
    getPath() {
        return this.request.uri;
    }
    getUrl() {
        const qs = this.request.querystring ? `?${this.request.querystring}` : '';
        return `https://${this.distributionDomain}${this.request.uri}${qs}`;
    }
    getAcceptHeader() {
        // Always return application/json to prevent HTML paywall in Lambda@Edge
        return constants_1.ContentType.JSON;
    }
    getUserAgent() {
        return this.getHeader(constants_1.Headers.USER_AGENT) ?? '';
    }
    getQueryParams() {
        const params = {};
        if (!this.request.querystring)
            return params;
        const searchParams = new URLSearchParams(this.request.querystring);
        for (const [key, value] of searchParams.entries()) {
            const existing = params[key];
            if (existing) {
                params[key] = Array.isArray(existing)
                    ? [...existing, value]
                    : [existing, value];
            }
            else {
                params[key] = value;
            }
        }
        return params;
    }
}
exports.CloudFrontHTTPAdapter = CloudFrontHTTPAdapter;
//# sourceMappingURL=cloudfront-http-adapter.js.map