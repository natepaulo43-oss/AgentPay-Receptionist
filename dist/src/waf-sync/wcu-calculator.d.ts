/**
 * x402 on AWS Edge - WCU (WAF Capacity Unit) Calculator
 *
 * Calculates the WCU cost of WAF rules to ensure they fit within
 * the rule group's capacity limit. Each statement type has a fixed
 * WCU cost per AWS WAF pricing:
 *
 * - ByteMatch (EXACTLY / STARTS_WITH): 1 WCU
 * - RegexMatch: 3 WCU
 * - LabelMatch: 1 WCU per entry
 * - SizeConstraint: 1 WCU
 * - AND/OR/NOT wrappers: 0 WCU (they wrap existing statements)
 */
import type { WafRule, WafStatement } from './types';
/** Maximum WCU capacity of the WAF Rule Group. Must match Capacity in template.yaml. */
export declare const RULE_GROUP_CAPACITY = 300;
/** Number of guarded headers in the guard rule (OR of SizeConstraint statements). */
export declare const GUARD_RULE_HEADER_COUNT = 10;
/** Number of actor-type bot signal rules. */
export declare const BOT_SIGNAL_ACTOR_TYPE_COUNT = 3;
/** Number of bot category signal rules (1 dynamic label namespace rule). */
export declare const BOT_SIGNAL_CATEGORY_COUNT = 1;
/** Number of bot organization signal rules (1 dynamic label namespace rule). */
export declare const BOT_SIGNAL_ORG_COUNT = 1;
/** Number of bot name signal rules (1 dynamic label namespace rule). */
export declare const BOT_SIGNAL_NAME_COUNT = 1;
/** WCU consumed by the guard rule (OR of SizeConstraint statements, 1 WCU each). */
export declare const GUARD_RULE_WCU = 10;
/** WCU consumed by all bot signal forwarding rules (1 LabelMatch each = 1 WCU each). */
export declare const BOT_SIGNAL_WCU: number;
/** Total fixed overhead WCU (guard rule + bot signal rules). */
export declare const FIXED_OVERHEAD_WCU: number;
/**
 * Calculate the WCU cost of a single WafStatement.
 *
 * - byteMatchStatement → 1 WCU
 * - regexMatchStatement → 3 WCU
 * - labelMatchStatements → 1 WCU per entry
 * - andStatement → sum of children (AND wrapper is free)
 * - orStatement → sum of children (OR wrapper is free)
 * - notStatement → WCU of inner statement (NOT wrapper is free)
 */
export declare function calculateStatementWcu(statement: WafStatement): number;
/**
 * Calculate the WCU cost of a single WAF rule.
 */
export declare function calculateRuleWcu(rule: WafRule): number;
/**
 * Calculate the total WCU for a set of route rules, including fixed overhead.
 */
export declare function calculateTotalWcu(rules: WafRule[]): {
    routeRulesWcu: number;
    fixedOverheadWcu: number;
    totalWcu: number;
};
/**
 * Validate that the total WCU of route rules plus fixed overhead
 * fits within the rule group capacity.
 */
export declare function validateWcuCapacity(rules: WafRule[]): {
    valid: boolean;
    totalWcu: number;
    capacity: number;
    routeRulesWcu: number;
    fixedOverheadWcu: number;
};
//# sourceMappingURL=wcu-calculator.d.ts.map