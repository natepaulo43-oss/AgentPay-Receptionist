/**
 * Hash-based change detector for Route_Config.
 *
 * Computes a deterministic SHA-256 hash of a Route_Config object by
 * normalizing key order via sorted JSON serialization. Used by the
 * WAF_Sync_Function to skip unnecessary WAF API updates when the
 * Route_Config has not changed since the last sync.
 *
 * @module waf-sync/change-detector
 */
import type { RouteConfig } from './types';
/**
 * Compute a deterministic SHA-256 hash of a Route_Config object.
 *
 * The config is first normalized by recursively sorting all object keys,
 * then serialized to JSON along with the translation format version.
 * This ensures that:
 * - Two Route_Config objects with identical content but different property
 *   ordering produce the same hash.
 * - Changes to the translation logic (bumped version) invalidate the hash
 *   even when the config content hasn't changed.
 *
 * @param config - The Route_Config to hash.
 * @returns A lowercase hex-encoded SHA-256 hash string.
 *
 * @example
 * ```typescript
 * const hash = computeHash({ routes: [{ pattern: '/**', policies: [{ condition: 'default', action: '0' }] }] });
 * // Returns a 64-character hex string like "a1b2c3d4..."
 * ```
 */
export declare function computeHash(config: RouteConfig): string;
/**
 * Compare the current Route_Config hash against the last-synced hash
 * to determine whether a WAF update is needed.
 *
 * @param currentHash - The hash of the current Route_Config.
 * @param lastHash - The hash from the last successful WAF sync.
 * @returns `true` if the hashes differ (WAF update needed), `false` if they match (skip update).
 *
 * @example
 * ```typescript
 * const current = computeHash(newConfig);
 * const last = getStoredHash(); // from SSM parameter or WAF rule group tag
 * if (hasChanged(current, last)) {
 *   // Update WAF rules
 * }
 * ```
 */
export declare function hasChanged(currentHash: string, lastHash: string): boolean;
//# sourceMappingURL=change-detector.d.ts.map