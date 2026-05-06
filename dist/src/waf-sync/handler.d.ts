/**
 * x402 on AWS Edge - WAF Sync Function Handler
 *
 * A regional Lambda function (NOT Lambda@Edge) that keeps the WAF_Rule_Group
 * in sync with the Route_Config stored in SSM Parameter Store.
 *
 * This function:
 * 1. Reads Route_Config from SSM Parameter Store
 * 2. Computes a hash of the Route_Config content
 * 3. Compares hash against the last-synced hash (stored in SSM)
 * 4. If unchanged → skips WAF update, logs "no changes detected"
 * 5. If changed → translates Route_Config to WAF rules and updates WAF_Rule_Group
 * 6. Stores the new hash for next comparison
 *
 * Triggered by:
 * - EventBridge rule matching SSM Parameter Store change events (near-instant)
 *
 * Since this is a regional Lambda (not Lambda@Edge), it CAN use environment variables:
 * - STACK_NAME: CloudFormation stack name
 * - WAF_RULE_GROUP_NAME: WAF Rule Group name
 * - WAF_RULE_GROUP_ID: WAF Rule Group ID
 * - SSM_ROUTES_PATH: Full SSM parameter path for routes config
 * - SSM_HASH_PATH: Full SSM parameter path for storing the last sync hash
 *
 */
import { SSMClient } from '@aws-sdk/client-ssm';
import { WAFV2Client } from '@aws-sdk/client-wafv2';
import type { WafRule, WafStatement } from './types';
/**
 * Translate a WafStatement (our internal format) to the AWS WAFv2 API format.
 */
declare function toAwsStatement(statement: WafStatement): Record<string, unknown>;
/**
 * Translate our internal WafRule[] to the AWS WAFv2 API Rules format.
 * Prepends a guard rule that blocks requests with a spoofed
 * x-x402-route-action header. Appends bot signal forwarding rules
 * that translate Bot Control labels into custom headers for Lambda@Edge.
 */
declare function toAwsRules(rules: WafRule[]): Record<string, unknown>[];
/**
 * EventBridge event shape for SSM Parameter Store change events
 * and scheduled events.
 */
interface EventBridgeEvent {
    'detail-type'?: string;
    source?: string;
    detail?: Record<string, unknown>;
    [key: string]: unknown;
}
/**
 * WAF Sync Function entry point.
 *
 * Handles both EventBridge SSM change events and scheduled events.
 * Both trigger the same sync logic:
 * 1. Read Route_Config from SSM
 * 2. Compute hash and compare against stored hash
 * 3. If changed → translate to WAF rules and update WAF_Rule_Group
 * 4. Store new hash
 *
 * @param event - EventBridge event (SSM change or scheduled)
 *
 */
export declare const handler: (event: EventBridgeEvent) => Promise<void>;
/**
 * Override the SSM client. Used in tests to inject mocks.
 */
export declare function _setSsmClient(client: SSMClient): void;
/**
 * Override the WAFv2 client. Used in tests to inject mocks.
 */
export declare function _setWafv2Client(client: WAFV2Client): void;
/**
 * Exported for testing: translate internal WafRule[] to AWS WAFv2 API format.
 */
export { toAwsRules, toAwsStatement };
//# sourceMappingURL=handler.d.ts.map