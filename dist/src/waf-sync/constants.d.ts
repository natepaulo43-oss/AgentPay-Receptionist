/**
 * x402 on AWS Edge - WAF Sync Constants
 *
 * Centralizes all magic strings used by the WAF sync backoffice function.
 */
export declare const WafLabels: {
    /** Prefix for bot category labels. */
    readonly CATEGORY: "awswaf:managed:aws:bot-control:bot:category:";
    /** Prefix for bot organization labels. */
    readonly ORGANIZATION: "awswaf:managed:aws:bot-control:bot:organization:";
    /** Prefix for bot name labels. */
    readonly NAME: "awswaf:managed:aws:bot-control:bot:name:";
    /** Exact label for verified bots. */
    readonly VERIFIED: "awswaf:managed:aws:bot-control:bot:verified";
    /** Exact label for WBA-verified bots. */
    readonly WBA_VERIFIED: "awswaf:managed:aws:bot-control:bot:web_bot_auth:verified";
};
export declare const ActorType: {
    readonly UNVERIFIED_BOT: "unverified-bot";
    readonly VERIFIED_BOT: "verified-bot";
    readonly WBA_VERIFIED_BOT: "wba-verified-bot";
};
export declare const BotSignalHeaders: {
    readonly ACTOR_TYPE: "actor-type";
    readonly BOT_CATEGORY: "bot-category";
    readonly BOT_ORGANIZATION: "bot-organization";
    readonly BOT_NAME: "bot-name";
};
export declare const WafScope: {
    readonly CLOUDFRONT: "CLOUDFRONT";
};
export declare const WafTextTransformation: {
    readonly NONE: "NONE";
};
export declare const WafComparisonOperator: {
    readonly GE: "GE";
};
export declare const LabelMatchScope: {
    readonly LABEL: "LABEL";
    readonly NAMESPACE: "NAMESPACE";
};
export declare const RouteAction: {
    readonly BLOCK: "block";
    readonly FREE: "0";
};
export declare const GuardRule: {
    readonly NAME: "guard-block-spoofed-headers";
};
export declare const RouteMatchedLabel: {
    readonly KEY: "x402:route-matched";
};
export declare const SsmParameterType: {
    readonly STRING: "String";
};
export declare const AwsErrors: {
    readonly PARAMETER_NOT_FOUND: "ParameterNotFound";
};
export declare const WafEnvVars: {
    readonly SSM_ROUTES_PATH: "SSM_ROUTES_PATH";
    readonly SSM_HASH_PATH: "SSM_HASH_PATH";
    readonly WAF_RULE_GROUP_NAME: "WAF_RULE_GROUP_NAME";
    readonly WAF_RULE_GROUP_ID: "WAF_RULE_GROUP_ID";
};
export declare const DefaultCondition: {
    readonly VALUE: "default";
};
//# sourceMappingURL=constants.d.ts.map