/**
 * x402 Server Factory
 *
 * Creates and initializes an x402HTTPResourceServer following the upstream
 * cloudfront-lambda-edge example pattern from @x402/core.
 *
 * @see https://github.com/coinbase/x402/tree/main/examples/typescript/servers/cloudfront-lambda-edge
 */
import type { RoutesConfig, FacilitatorConfig } from '@x402/core/server';
import { x402HTTPResourceServer } from '@x402/core/server';
/**
 * Configuration for creating an x402 server.
 * Mirrors the upstream X402ServerConfig interface.
 */
export interface X402ServerConfig {
    /** Facilitator URL (e.g., 'https://x402.org/facilitator') */
    facilitatorUrl: string;
    /** Network ID (e.g., 'eip155:84532' for Base Sepolia) */
    network: string;
    /** Route configuration defining which paths require payment */
    routes: RoutesConfig;
    /** Optional facilitator config with auth headers (for facilitators that require authentication) */
    facilitatorConfig?: FacilitatorConfig;
}
/**
 * Creates and initializes an x402HTTPResourceServer.
 *
 * Follows the upstream pattern: uses facilitatorConfig if provided,
 * otherwise falls back to { url: facilitatorUrl }.
 */
export declare function createX402Server(config: X402ServerConfig): Promise<x402HTTPResourceServer>;
//# sourceMappingURL=x402-server.d.ts.map