/**
 * x402 on AWS Edge - Config Loader Module
 *
 * Handles loading and caching of configuration from AWS Systems Manager (SSM)
 * Parameter Store and AWS Secrets Manager for AWS Lambda@Edge functions.
 *
 * Loads:
 * - EdgeConfig from SSM: PayTo, Network, Facilitator URL
 * - CDP credentials from Secrets Manager (when CDP facilitator is detected)
 *
 * Caching behavior:
 * - EdgeConfig (including CDP credentials): cached in module-level variable,
 *   refreshed when TTL expires
 * - On cold start or cache miss: fetch SSM params in parallel via Promise.all,
 *   then conditionally fetch CDP credentials from Secrets Manager
 * - Cache is per Lambda container instance (survives across invocations within same container)
 * - TTL is configurable, defaults to 300 seconds
 *
 */
import { SSMClient } from '@aws-sdk/client-ssm';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import type { EdgeConfig, ConfigCache } from './types';
/**
 * Get the edge configuration (PayTo, Network, Facilitator URL).
 *
 * Returns cached config if within TTL. On cache miss or cold start,
 * fetches from SSM Parameter Store.
 *
 * Error handling:
 * - If fetch fails and cached config is available, returns cached config
 * - If fetch fails and no cached config exists (cold start), throws an error
 *   (caller should return 503 Service Unavailable)
 *
 * @returns Promise resolving to the EdgeConfig
 * @throws Error if config cannot be fetched and no cache is available
 *
 */
export declare function getEdgeConfig(): Promise<EdgeConfig>;
/**
 * Reset the module-level cache. Used in tests to ensure clean state
 * between test cases.
 */
export declare function resetCache(): void;
/**
 * Set a custom TTL for the cache. Used in tests to control cache behavior.
 *
 * @param ttlSeconds - TTL in seconds
 */
export declare function _setTtl(ttlSeconds: number): void;
/**
 * Override the SSM prefix. Used in tests to avoid hitting real AWS resources.
 *
 * @param prefix - SSM parameter prefix
 */
export declare function _setSsmPrefix(prefix: string): void;
/**
 * Override the SSM client. Used in tests to inject mocks.
 *
 * @param client - SSM client instance
 */
export declare function _setSsmClient(client: SSMClient): void;
/**
 * Override the Secrets Manager client. Used in tests to inject mocks.
 *
 * @param client - SecretsManager client instance
 */
export declare function _setSecretsManagerClient(client: SecretsManagerClient): void;
/**
 * Override the derived stack name. Used in tests to control Secrets Manager key.
 *
 * @param stackName - Stack name to use
 */
export declare function _setStackName(stackName: string): void;
/**
 * Get the current cache state. Used in tests to inspect cache behavior.
 */
export declare function _getCache(): ConfigCache;
/**
 * Get the derived deployment region. Used in tests to verify region extraction.
 */
export declare function _getDeployRegion(): string | null;
//# sourceMappingURL=config-loader.d.ts.map