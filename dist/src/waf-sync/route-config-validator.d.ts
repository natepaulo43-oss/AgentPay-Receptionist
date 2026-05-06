/**
 * x402 on AWS Edge - Route Config Validator
 *
 * Validates Route_Config JSON objects against the expected schema.
 * Returns a typed `RouteConfig` on success or a descriptive validation
 * error on failure.
 *
 */
import type { RouteConfig } from './types';
/** Result of a Route_Config validation attempt. */
export type ValidationResult = {
    success: true;
    config: RouteConfig;
} | {
    success: false;
    error: string;
};
/**
 * Parse a JSON string as a Route_Config.
 *
 * @param json - The raw JSON string to parse and validate
 * @returns A `ValidationResult` with either the typed `RouteConfig` or a descriptive error
 */
export declare function parseRouteConfig(json: string): ValidationResult;
//# sourceMappingURL=route-config-validator.d.ts.map