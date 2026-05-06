/**
 * x402 on AWS Edge - Runtime Shared Constants
 *
 * Centralizes all magic strings used across runtime Lambda@Edge handlers.
 * Import from this module instead of using inline string literals.
 */
export declare const Headers: {
    /** WAF-prefixed route action header (as it arrives at Lambda@Edge). */
    readonly WAF_ROUTE_ACTION: "x-amzn-waf-x-x402-route-action";
    /** Internal route action header name (before WAF prefixing). */
    readonly ROUTE_ACTION: "x-x402-route-action";
    /** Pending settlement data passed between origin-request and origin-response. */
    readonly PENDING_SETTLEMENT: "x-x402-pending-settlement";
    /** Payment signature header (x402 v2 protocol). */
    readonly PAYMENT_SIGNATURE: "payment-signature";
    /** Payment header (x402 v1 protocol). */
    readonly X_PAYMENT: "x-payment";
    /** Settlement response header from the facilitator. */
    readonly PAYMENT_RESPONSE: "x-payment-response";
    /** Standard X-Forwarded-For header for client IP extraction. */
    readonly FORWARDED_FOR: "x-forwarded-for";
    /** Standard Host header. */
    readonly HOST: "host";
    /** Standard User-Agent header. */
    readonly USER_AGENT: "user-agent";
    /** Standard Content-Type header. */
    readonly CONTENT_TYPE: "content-type";
    /** Standard Cache-Control header. */
    readonly CACHE_CONTROL: "cache-control";
    /** Payment-Required header in x402 responses. */
    readonly PAYMENT_REQUIRED: "PAYMENT-REQUIRED";
    /** WAF bot actor type header. */
    readonly WAF_ACTOR_TYPE: "x-amzn-waf-actor-type";
    /** WAF bot category header. */
    readonly WAF_BOT_CATEGORY: "x-amzn-waf-bot-category";
    /** WAF bot organization header. */
    readonly WAF_BOT_ORGANIZATION: "x-amzn-waf-bot-organization";
    /** WAF bot name header. */
    readonly WAF_BOT_NAME: "x-amzn-waf-bot-name";
    /** WAF header prefix used for filtering bot headers. */
    readonly WAF_PREFIX: "x-amzn-waf-";
};
export declare const ContentType: {
    readonly JSON: "application/json";
};
export declare const CacheControl: {
    readonly NO_STORE: "no-store";
};
export declare const EventType: {
    readonly SETTLEMENT: "settlement";
    readonly VERIFICATION: "verification";
    readonly PAYMENT_REQUESTED: "payment-requested";
    readonly PASSTHROUGH: "passthrough";
};
export declare const RequestResultType: {
    readonly PASS_THROUGH: "pass-through";
    readonly PAYMENT_ERROR: "payment-error";
};
export declare const ResponseResultType: {
    readonly PASS_THROUGH: "pass-through";
    readonly SETTLED: "settled";
    readonly SETTLEMENT_FAILED: "settlement-failed";
};
export declare const BotDefaults: {
    readonly ACTOR_TYPE: "human";
    readonly CATEGORY: "none";
    readonly ORGANIZATION: "unknown";
    readonly NAME: "unknown";
};
export declare const RouteDefaults: {
    /** Default catch-all route path used in dynamic RoutesConfig. */
    readonly CATCH_ALL_PATH: "/*";
    /** Description shown in x402 402 responses for paid business actions. */
    readonly BUSINESS_ACTION_DESCRIPTION: "Hold a priority appointment slot with a local business receptionist.";
    /** Price value indicating free access (no payment required). */
    readonly FREE_PRICE: "0";
    /** Fallback value when client IP cannot be determined. */
    readonly UNKNOWN_CLIENT: "[unknown]";
};
export declare const HttpStatus: {
    readonly PAYMENT_REQUIRED: 402;
    readonly PAYMENT_REQUIRED_DESCRIPTION: "Payment Required";
    readonly ERROR_DESCRIPTION: "Error";
    /** Origin status threshold above which settlement is skipped. */
    readonly ERROR_THRESHOLD: 400;
};
export declare const SsmConfig: {
    readonly PREFIX: "/x402-edge/";
    readonly SUFFIX_CONFIG: "/config";
    readonly KEY_PAYTO: "/payto";
    readonly KEY_NETWORK: "/network";
    readonly KEY_FACILITATOR_URL: "/facilitator-url";
};
export declare const CdpConfig: {
    readonly FACILITATOR_URL: "https://api.cdp.coinbase.com/platform/v2/x402";
    readonly FACILITATOR_HOST: "api.cdp.coinbase.com";
    readonly FACILITATOR_ROUTE: "/platform/v2/x402";
    /** Secrets Manager name pattern for CDP credentials. Full name: x402-edge/{stack}/cdp-credentials */
    readonly SECRET_PREFIX: "x402-edge/";
    readonly SECRET_SUFFIX: "/cdp-credentials";
};
export declare const EnvVars: {
    readonly LAMBDA_FUNCTION_NAME: "AWS_LAMBDA_FUNCTION_NAME";
};
//# sourceMappingURL=constants.d.ts.map