/**
 * x402 on AWS Edge - AWS WAF Rule Translator
 *
 * Translates a Route_Config into an ordered list of AWS WAF rules for the
 * WAF_Rule_Group. Each route + policy combination becomes a single WAF rule:
 *
 * - **Block actions** → WAF Block rule
 * - **Price actions** (including "0") → WAF Count rule with `InsertHeader`
 *   custom request header `x-x402-route-action: <price>` and a
 *   `x402:route-matched` label. Subsequent rules include a scope-down
 *   NOT LabelMatch so only the first matching rule captures the request.
 *
 * Rules are assigned priorities in route order then policy order so that
 * the first matching policy wins (consistent with WAF evaluation semantics).
 *
 * Each rule combines a URI path byte-match statement (from the route pattern
 * translator) with WAF label-match statements for the condition.
 *
 */
import type { RouteConfig, WafRule } from './types';
/**
 * Translate a complete Route_Config into an ordered list of WAF rules.
 *
 * For each route in the config, and for each policy within that route,
 * a WAF rule is generated that combines:
 * 1. A URI path byte-match statement (from the route's glob pattern)
 * 2. WAF label-match statements for the policy's condition
 *
 * Priorities are assigned sequentially across all routes and policies,
 * ensuring first-match-wins semantics consistent with the Access_Policy
 * list order.
 *
 * @param config - The Route_Config to translate
 * @returns An ordered array of WAF rules ready for the WAF_Rule_Group
 *
 */
export declare function translateRouteConfig(config: RouteConfig): WafRule[];
//# sourceMappingURL=waf-rule-translator.d.ts.map