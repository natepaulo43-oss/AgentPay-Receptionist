/**
 * CDP (Coinbase Developer Platform) JWT Authentication
 *
 * Generates JWT Bearer tokens for authenticating with the CDP facilitator.
 * Replaces the @coinbase/x402 package to avoid its LGPL-3.0 transitive
 * dependency chain (rpc-websockets via @solana/web3.js).
 *
 * Uses the `jose` library (MIT) for JWT signing with ES256 keys.
 */
import type { FacilitatorConfig } from '@x402/core/server';
/**
 * Create a FacilitatorConfig for the CDP facilitator.
 *
 * Returns a config object compatible with @x402/core's HTTPFacilitatorClient
 * that provides per-endpoint JWT auth headers.
 *
 * @param apiKeyId - CDP API key name/ID
 * @param apiKeySecret - CDP API key private key (PEM PKCS#8)
 */
export declare function createCdpFacilitatorConfig(apiKeyId: string, apiKeySecret: string): FacilitatorConfig;
//# sourceMappingURL=cdp-auth.d.ts.map