"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FIXED_OVERHEAD_WCU = exports.BOT_SIGNAL_WCU = exports.GUARD_RULE_WCU = exports.BOT_SIGNAL_NAME_COUNT = exports.BOT_SIGNAL_ORG_COUNT = exports.BOT_SIGNAL_CATEGORY_COUNT = exports.BOT_SIGNAL_ACTOR_TYPE_COUNT = exports.GUARD_RULE_HEADER_COUNT = exports.RULE_GROUP_CAPACITY = void 0;
exports.calculateStatementWcu = calculateStatementWcu;
exports.calculateRuleWcu = calculateRuleWcu;
exports.calculateTotalWcu = calculateTotalWcu;
exports.validateWcuCapacity = validateWcuCapacity;
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
/** Maximum WCU capacity of the WAF Rule Group. Must match Capacity in template.yaml. */
exports.RULE_GROUP_CAPACITY = 300;
/** Number of guarded headers in the guard rule (OR of SizeConstraint statements). */
exports.GUARD_RULE_HEADER_COUNT = 10;
/** Number of actor-type bot signal rules. */
exports.BOT_SIGNAL_ACTOR_TYPE_COUNT = 3;
/** Number of bot category signal rules (1 dynamic label namespace rule). */
exports.BOT_SIGNAL_CATEGORY_COUNT = 1;
/** Number of bot organization signal rules (1 dynamic label namespace rule). */
exports.BOT_SIGNAL_ORG_COUNT = 1;
/** Number of bot name signal rules (1 dynamic label namespace rule). */
exports.BOT_SIGNAL_NAME_COUNT = 1;
/** WCU consumed by the guard rule (OR of SizeConstraint statements, 1 WCU each). */
exports.GUARD_RULE_WCU = exports.GUARD_RULE_HEADER_COUNT;
/** WCU consumed by all bot signal forwarding rules (1 LabelMatch each = 1 WCU each). */
exports.BOT_SIGNAL_WCU = exports.BOT_SIGNAL_ACTOR_TYPE_COUNT +
    exports.BOT_SIGNAL_CATEGORY_COUNT +
    exports.BOT_SIGNAL_ORG_COUNT +
    exports.BOT_SIGNAL_NAME_COUNT;
/** Total fixed overhead WCU (guard rule + bot signal rules). */
exports.FIXED_OVERHEAD_WCU = exports.GUARD_RULE_WCU + exports.BOT_SIGNAL_WCU;
// ---------------------------------------------------------------------------
// WCU Calculation Functions
// ---------------------------------------------------------------------------
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
function calculateStatementWcu(statement) {
    if (statement.byteMatchStatement) {
        return 1;
    }
    if (statement.regexMatchStatement) {
        return 3;
    }
    if (statement.labelMatchStatements && statement.labelMatchStatements.length > 0) {
        return statement.labelMatchStatements.length;
    }
    if (statement.andStatement) {
        return statement.andStatement.statements.reduce((sum, child) => sum + calculateStatementWcu(child), 0);
    }
    if (statement.orStatement) {
        return statement.orStatement.statements.reduce((sum, child) => sum + calculateStatementWcu(child), 0);
    }
    if (statement.notStatement) {
        return calculateStatementWcu(statement.notStatement.statement);
    }
    return 0;
}
/**
 * Calculate the WCU cost of a single WAF rule.
 */
function calculateRuleWcu(rule) {
    return calculateStatementWcu(rule.statement);
}
/**
 * Calculate the total WCU for a set of route rules, including fixed overhead.
 */
function calculateTotalWcu(rules) {
    const routeRulesWcu = rules.reduce((sum, rule) => sum + calculateRuleWcu(rule), 0);
    return {
        routeRulesWcu,
        fixedOverheadWcu: exports.FIXED_OVERHEAD_WCU,
        totalWcu: routeRulesWcu + exports.FIXED_OVERHEAD_WCU,
    };
}
/**
 * Validate that the total WCU of route rules plus fixed overhead
 * fits within the rule group capacity.
 */
function validateWcuCapacity(rules) {
    const { routeRulesWcu, fixedOverheadWcu, totalWcu } = calculateTotalWcu(rules);
    return {
        valid: totalWcu <= exports.RULE_GROUP_CAPACITY,
        totalWcu,
        capacity: exports.RULE_GROUP_CAPACITY,
        routeRulesWcu,
        fixedOverheadWcu,
    };
}
//# sourceMappingURL=wcu-calculator.js.map