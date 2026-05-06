"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEdgeConfig = getEdgeConfig;
exports.resetCache = resetCache;
exports._setTtl = _setTtl;
exports._setSsmPrefix = _setSsmPrefix;
exports._setSsmClient = _setSsmClient;
exports._setSecretsManagerClient = _setSecretsManagerClient;
exports._setStackName = _setStackName;
exports._getCache = _getCache;
exports._getDeployRegion = _getDeployRegion;
const client_ssm_1 = require("@aws-sdk/client-ssm");
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
const constants_1 = require("./constants");
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
/**
 * SSM parameter prefix. Derived at runtime from the Lambda function name.
 * The function name follows the pattern `{stack-name}-origin-request` or
 * `{stack-name}-origin-response`, so we strip the last segment to get the
 * stack name and construct the SSM prefix.
 *
 * For local development/testing, this can be overridden via `_setSsmPrefix`.
 */
let SSM_PREFIX = `${constants_1.SsmConfig.PREFIX}STACK_NAME${constants_1.SsmConfig.SUFFIX_CONFIG}`;
/** Whether runtime derivation has been attempted. */
let runtimeDerived = false;
/** Derived stack name, used for SSM parameter paths. */
let derivedStackName = null;
/**
 * Derived deployment region from the Lambda function name.
 * Lambda@Edge replicated functions include the deployment region as a prefix
 * (e.g., `us-east-1.stack-name-origin-request`). This region tells us where
 * SSM Parameter Store and Secrets Manager resources were created during
 * stack deployment, so SDK clients must target this region.
 */
let derivedDeployRegion = null;
/**
 * Derive SSM_PREFIX and stack name from the Lambda function name.
 * AWS_LAMBDA_FUNCTION_NAME is available in Lambda@Edge (unlike custom env vars).
 *
 * Lambda@Edge replicated functions have the name format:
 *   `{region}.{stack-name}-origin-request` or `{region}.{stack-name}-origin-response`
 * The original (us-east-1) function name is:
 *   `{stack-name}-origin-request` or `{stack-name}-origin-response`
 *
 * We strip both the optional region prefix and the `-origin-request`/`-origin-response`
 * suffix to recover the stack name.
 */
function deriveFromFunctionName() {
    if (runtimeDerived)
        return;
    runtimeDerived = true;
    const functionName = process.env[constants_1.EnvVars.LAMBDA_FUNCTION_NAME];
    if (!functionName)
        return; // running in tests or locally
    // Extract the optional region prefix (e.g., "us-east-1.") that Lambda@Edge
    // adds to replicated function names, then strip the suffix.
    // The region prefix indicates the deployment region where SSM parameters and
    // Secrets Manager secrets are stored.
    const match = functionName.match(/^(?:([a-z]{2}-[a-z]+-\d+)\.)?(.+)-origin-(?:request|response)$/);
    if (match) {
        derivedDeployRegion = match[1] ?? null; // null when running in us-east-1 (no prefix)
        derivedStackName = match[2];
        SSM_PREFIX = `${constants_1.SsmConfig.PREFIX}${derivedStackName}${constants_1.SsmConfig.SUFFIX_CONFIG}`;
        // Re-initialize SDK clients targeting the deployment region so they
        // connect to SSM/Secrets Manager where the stack resources live,
        // not the edge location where this Lambda@Edge replica is executing.
        if (derivedDeployRegion) {
            ssmClient = new client_ssm_1.SSMClient({ region: derivedDeployRegion });
            secretsManagerClient = new client_secrets_manager_1.SecretsManagerClient({ region: derivedDeployRegion });
        }
    }
}
/** Default cache TTL in seconds. */
const DEFAULT_TTL_SECONDS = 300;
// ---------------------------------------------------------------------------
// AWS SDK Clients (module-level singletons for connection reuse)
// ---------------------------------------------------------------------------
let ssmClient = new client_ssm_1.SSMClient({});
let secretsManagerClient = new client_secrets_manager_1.SecretsManagerClient({});
// ---------------------------------------------------------------------------
// Module-level Cache
// ---------------------------------------------------------------------------
let cache = {
    edgeConfig: null,
    lastFetched: 0,
    ttl: DEFAULT_TTL_SECONDS * 1000, // stored in ms internally
};
// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------
/**
 * Check whether the cache is still valid (within TTL window).
 */
function isCacheValid() {
    if (cache.lastFetched === 0)
        return false;
    return Date.now() - cache.lastFetched < cache.ttl;
}
/**
 * Check whether a facilitator URL points to the CDP facilitator.
 */
function isCdpFacilitator(facilitatorUrl) {
    return facilitatorUrl.includes(constants_1.CdpConfig.FACILITATOR_HOST);
}
/**
 * Fetch CDP credentials from Secrets Manager.
 * The secret name follows the pattern: `x402-edge/{stackName}/cdp-credentials`.
 */
async function fetchCdpCredentials() {
    const stackName = derivedStackName ?? 'STACK_NAME';
    const secretName = `${constants_1.CdpConfig.SECRET_PREFIX}${stackName}${constants_1.CdpConfig.SECRET_SUFFIX}`;
    const result = await secretsManagerClient.send(new client_secrets_manager_1.GetSecretValueCommand({ SecretId: secretName }));
    if (!result.SecretString) {
        throw new Error(`CDP credentials secret "${secretName}" has no value`);
    }
    const parsed = JSON.parse(result.SecretString);
    const apiKeyName = parsed.apiKeyName;
    const apiKeyPrivateKey = parsed.apiKeyPrivateKey;
    if (typeof apiKeyName !== 'string' || typeof apiKeyPrivateKey !== 'string') {
        throw new Error(`CDP credentials secret "${secretName}" is missing apiKeyName or apiKeyPrivateKey`);
    }
    return { apiKeyName, apiKeyPrivateKey };
}
/**
 * Fetch EdgeConfig from SSM Parameter Store.
 * Fetches PayTo, Network, and Facilitator URL in parallel.
 * If the facilitator URL indicates CDP, also fetches CDP credentials
 * from Secrets Manager.
 */
async function fetchEdgeConfig() {
    deriveFromFunctionName();
    const [payToResult, networkResult, facilitatorUrlResult] = await Promise.all([
        ssmClient.send(new client_ssm_1.GetParameterCommand({ Name: `${SSM_PREFIX}${constants_1.SsmConfig.KEY_PAYTO}` })),
        ssmClient.send(new client_ssm_1.GetParameterCommand({ Name: `${SSM_PREFIX}${constants_1.SsmConfig.KEY_NETWORK}` })),
        ssmClient.send(new client_ssm_1.GetParameterCommand({ Name: `${SSM_PREFIX}${constants_1.SsmConfig.KEY_FACILITATOR_URL}` })),
    ]);
    const payTo = payToResult.Parameter?.Value;
    const network = networkResult.Parameter?.Value;
    const facilitatorUrl = facilitatorUrlResult.Parameter?.Value;
    if (!payTo || !network || !facilitatorUrl) {
        throw new Error('Missing required SSM parameters: ' +
            [
                !payTo && constants_1.SsmConfig.KEY_PAYTO.slice(1),
                !network && constants_1.SsmConfig.KEY_NETWORK.slice(1),
                !facilitatorUrl && constants_1.SsmConfig.KEY_FACILITATOR_URL.slice(1),
            ]
                .filter(Boolean)
                .join(', '));
    }
    const edgeConfig = { payTo, network, facilitatorUrl };
    // If CDP facilitator, fetch credentials from Secrets Manager
    if (isCdpFacilitator(facilitatorUrl)) {
        edgeConfig.cdpCredentials = await fetchCdpCredentials();
    }
    return edgeConfig;
}
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
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
async function getEdgeConfig() {
    // Cache hit — return cached value
    if (isCacheValid() && cache.edgeConfig) {
        return cache.edgeConfig;
    }
    // Cache miss or expired — fetch fresh data
    try {
        const edgeConfig = await fetchEdgeConfig();
        cache.edgeConfig = edgeConfig;
        cache.lastFetched = Date.now();
        return edgeConfig;
    }
    catch (error) {
        // Fallback to stale cache if available
        if (cache.edgeConfig) {
            console.warn('Failed to refresh config from SSM, using stale cache:', error instanceof Error ? error.message : String(error));
            return cache.edgeConfig;
        }
        // No cache available (cold start failure) — propagate error
        throw new Error(`Config loader: unable to fetch edge config and no cache available. ${error instanceof Error ? error.message : String(error)}`);
    }
}
// ---------------------------------------------------------------------------
// Test Helpers (exported for testing purposes only)
// ---------------------------------------------------------------------------
/**
 * Reset the module-level cache. Used in tests to ensure clean state
 * between test cases.
 */
function resetCache() {
    cache = {
        edgeConfig: null,
        lastFetched: 0,
        ttl: DEFAULT_TTL_SECONDS * 1000,
    };
    runtimeDerived = false;
    derivedStackName = null;
    derivedDeployRegion = null;
    ssmClient = new client_ssm_1.SSMClient({});
    secretsManagerClient = new client_secrets_manager_1.SecretsManagerClient({});
}
/**
 * Set a custom TTL for the cache. Used in tests to control cache behavior.
 *
 * @param ttlSeconds - TTL in seconds
 */
function _setTtl(ttlSeconds) {
    cache.ttl = ttlSeconds * 1000;
}
/**
 * Override the SSM prefix. Used in tests to avoid hitting real AWS resources.
 *
 * @param prefix - SSM parameter prefix
 */
function _setSsmPrefix(prefix) {
    SSM_PREFIX = prefix;
    runtimeDerived = true; // prevent runtime derivation from overriding test value
}
/**
 * Override the SSM client. Used in tests to inject mocks.
 *
 * @param client - SSM client instance
 */
function _setSsmClient(client) {
    ssmClient = client;
}
/**
 * Override the Secrets Manager client. Used in tests to inject mocks.
 *
 * @param client - SecretsManager client instance
 */
function _setSecretsManagerClient(client) {
    secretsManagerClient = client;
}
/**
 * Override the derived stack name. Used in tests to control Secrets Manager key.
 *
 * @param stackName - Stack name to use
 */
function _setStackName(stackName) {
    derivedStackName = stackName;
}
/**
 * Get the current cache state. Used in tests to inspect cache behavior.
 */
function _getCache() {
    return { ...cache };
}
/**
 * Get the derived deployment region. Used in tests to verify region extraction.
 */
function _getDeployRegion() {
    return derivedDeployRegion;
}
//# sourceMappingURL=config-loader.js.map