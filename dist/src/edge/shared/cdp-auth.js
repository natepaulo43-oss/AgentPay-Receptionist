"use strict";
/**
 * CDP (Coinbase Developer Platform) JWT Authentication
 *
 * Generates JWT Bearer tokens for authenticating with the CDP facilitator.
 * Replaces the @coinbase/x402 package to avoid its LGPL-3.0 transitive
 * dependency chain (rpc-websockets via @solana/web3.js).
 *
 * Uses the `jose` library (MIT) for JWT signing with ES256 keys.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCdpFacilitatorConfig = createCdpFacilitatorConfig;
const jose_1 = require("jose");
const crypto_1 = require("crypto");
const constants_1 = require("./constants");
/**
 * Generate a CDP JWT for authenticating API requests.
 *
 * The JWT follows the CDP auth spec:
 * - Algorithm: ES256
 * - Claims: sub (API key ID), iss (cdp), nbf, exp (2 min), aud (host+path), uri (full URL)
 * - Header: kid (API key ID), nonce (random hex), typ (JWT)
 *
 * @param apiKeyId - CDP API key name/ID
 * @param apiKeySecret - CDP API key private key (PEM PKCS#8)
 * @param method - HTTP method (GET, POST)
 * @param host - Target host (e.g., api.cdp.coinbase.com)
 * @param path - Target path (e.g., /platform/v2/x402/verify)
 */
async function generateCdpJwt(apiKeyId, apiKeySecret, method, host, path) {
    const now = Math.floor(Date.now() / 1000);
    const uri = `${method.toUpperCase()} ${host}${path}`;
    const nonce = (0, crypto_1.randomBytes)(16).toString('hex');
    const privateKey = await (0, jose_1.importPKCS8)(apiKeySecret, 'ES256');
    return new jose_1.SignJWT({
        sub: apiKeyId,
        iss: 'cdp',
        aud: [`${host}${path}`],
        nbf: now,
        exp: now + 120,
        uri,
    })
        .setProtectedHeader({
        alg: 'ES256',
        kid: apiKeyId,
        nonce,
        typ: 'JWT',
    })
        .sign(privateKey);
}
/**
 * Create auth headers for a specific CDP facilitator endpoint.
 */
async function createEndpointHeaders(apiKeyId, apiKeySecret, method, path) {
    const jwt = await generateCdpJwt(apiKeyId, apiKeySecret, method, constants_1.CdpConfig.FACILITATOR_HOST, path);
    return { Authorization: `Bearer ${jwt}` };
}
/**
 * Create a FacilitatorConfig for the CDP facilitator.
 *
 * Returns a config object compatible with @x402/core's HTTPFacilitatorClient
 * that provides per-endpoint JWT auth headers.
 *
 * @param apiKeyId - CDP API key name/ID
 * @param apiKeySecret - CDP API key private key (PEM PKCS#8)
 */
function createCdpFacilitatorConfig(apiKeyId, apiKeySecret) {
    return {
        url: constants_1.CdpConfig.FACILITATOR_URL,
        createAuthHeaders: async () => ({
            verify: await createEndpointHeaders(apiKeyId, apiKeySecret, 'POST', `${constants_1.CdpConfig.FACILITATOR_ROUTE}/verify`),
            settle: await createEndpointHeaders(apiKeyId, apiKeySecret, 'POST', `${constants_1.CdpConfig.FACILITATOR_ROUTE}/settle`),
            supported: await createEndpointHeaders(apiKeyId, apiKeySecret, 'GET', `${constants_1.CdpConfig.FACILITATOR_ROUTE}/supported`),
        }),
    };
}
//# sourceMappingURL=cdp-auth.js.map