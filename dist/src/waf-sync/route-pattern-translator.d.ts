/**
 * x402 on AWS Edge - Route Pattern Translator
 *
 * Converts glob patterns from Route_Config into WAF matching statements.
 * Used by the WAF_Sync_Function during rule generation to translate URL
 * path patterns into WAF-compatible matching logic.
 *
 * Pattern translation rules:
 * - Exact paths (no wildcards) -> ByteMatch EXACTLY (1 WCU)
 * - Trailing multi-segment wildcard -> ByteMatch STARTS_WITH (1 WCU)
 * - Trailing single-segment wildcard -> RegexMatch (3 WCU)
 * - Mid-segment wildcards -> RegexMatch (3 WCU)
 *
 */
import type { WafStatement } from './types';
/**
 * Convert a glob pattern to a WAF statement (byte-match or regex-match).
 *
 * Uses ByteMatch (1 WCU) when possible, falls back to RegexMatch (3 WCU)
 * for patterns that ByteMatch cannot express accurately:
 *
 * - Exact paths (no wildcards) -> ByteMatch EXACTLY
 * - Trailing multi-segment wildcard -> ByteMatch STARTS_WITH
 * - Trailing single-segment wildcard -> RegexMatch
 * - Mid-segment wildcards -> RegexMatch
 *
 * @param pattern - A URL path glob pattern from Route_Config
 * @returns A WAF statement for URI path matching
 *
 */
export declare function toWafStatement(pattern: string): WafStatement;
//# sourceMappingURL=route-pattern-translator.d.ts.map