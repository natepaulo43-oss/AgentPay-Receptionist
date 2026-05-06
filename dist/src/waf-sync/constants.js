"use strict";
/**
 * x402 on AWS Edge - WAF Sync Constants
 *
 * Centralizes all magic strings used by the WAF sync backoffice function.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultCondition = exports.WafEnvVars = exports.AwsErrors = exports.SsmParameterType = exports.RouteMatchedLabel = exports.GuardRule = exports.RouteAction = exports.LabelMatchScope = exports.WafComparisonOperator = exports.WafTextTransformation = exports.WafScope = exports.BotSignalHeaders = exports.ActorType = exports.WafLabels = void 0;
// ---------------------------------------------------------------------------
// WAF Label Prefixes
// ---------------------------------------------------------------------------
const WAF_LABEL_BASE = 'awswaf:managed:aws:bot-control:bot';
exports.WafLabels = {
    /** Prefix for bot category labels. */
    CATEGORY: `${WAF_LABEL_BASE}:category:`,
    /** Prefix for bot organization labels. */
    ORGANIZATION: `${WAF_LABEL_BASE}:organization:`,
    /** Prefix for bot name labels. */
    NAME: `${WAF_LABEL_BASE}:name:`,
    /** Exact label for verified bots. */
    VERIFIED: `${WAF_LABEL_BASE}:verified`,
    /** Exact label for WBA-verified bots. */
    WBA_VERIFIED: `${WAF_LABEL_BASE}:web_bot_auth:verified`,
};
// ---------------------------------------------------------------------------
// WAF Actor Types
// ---------------------------------------------------------------------------
exports.ActorType = {
    UNVERIFIED_BOT: 'unverified-bot',
    VERIFIED_BOT: 'verified-bot',
    WBA_VERIFIED_BOT: 'wba-verified-bot',
};
// ---------------------------------------------------------------------------
// WAF Signal Header Names (unprefixed, used in Count InsertHeaders)
// ---------------------------------------------------------------------------
exports.BotSignalHeaders = {
    ACTOR_TYPE: 'actor-type',
    BOT_CATEGORY: 'bot-category',
    BOT_ORGANIZATION: 'bot-organization',
    BOT_NAME: 'bot-name',
};
// ---------------------------------------------------------------------------
// WAF Scope & Operators
// ---------------------------------------------------------------------------
exports.WafScope = {
    CLOUDFRONT: 'CLOUDFRONT',
};
exports.WafTextTransformation = {
    NONE: 'NONE',
};
exports.WafComparisonOperator = {
    GE: 'GE',
};
// ---------------------------------------------------------------------------
// WAF Label Match Scopes
// ---------------------------------------------------------------------------
exports.LabelMatchScope = {
    LABEL: 'LABEL',
    NAMESPACE: 'NAMESPACE',
};
// ---------------------------------------------------------------------------
// Route Action Constants
// ---------------------------------------------------------------------------
exports.RouteAction = {
    BLOCK: 'block',
    FREE: '0',
};
// ---------------------------------------------------------------------------
// Guard Rule
// ---------------------------------------------------------------------------
exports.GuardRule = {
    NAME: 'guard-block-spoofed-headers',
};
// ---------------------------------------------------------------------------
// WAF Rule Labels
// ---------------------------------------------------------------------------
exports.RouteMatchedLabel = {
    KEY: 'x402:route-matched',
};
// ---------------------------------------------------------------------------
// SSM Parameter Types
// ---------------------------------------------------------------------------
exports.SsmParameterType = {
    STRING: 'String',
};
// ---------------------------------------------------------------------------
// AWS Error Names
// ---------------------------------------------------------------------------
exports.AwsErrors = {
    PARAMETER_NOT_FOUND: 'ParameterNotFound',
};
// ---------------------------------------------------------------------------
// Environment Variables (WAF Sync specific)
// ---------------------------------------------------------------------------
exports.WafEnvVars = {
    SSM_ROUTES_PATH: 'SSM_ROUTES_PATH',
    SSM_HASH_PATH: 'SSM_HASH_PATH',
    WAF_RULE_GROUP_NAME: 'WAF_RULE_GROUP_NAME',
    WAF_RULE_GROUP_ID: 'WAF_RULE_GROUP_ID',
};
// ---------------------------------------------------------------------------
// Default Condition
// ---------------------------------------------------------------------------
exports.DefaultCondition = {
    VALUE: 'default',
};
//# sourceMappingURL=constants.js.map