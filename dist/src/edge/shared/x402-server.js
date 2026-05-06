"use strict";
/**
 * x402 Server Factory
 *
 * Creates and initializes an x402HTTPResourceServer following the upstream
 * cloudfront-lambda-edge example pattern from @x402/core.
 *
 * @see https://github.com/coinbase/x402/tree/main/examples/typescript/servers/cloudfront-lambda-edge
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createX402Server = createX402Server;
const server_1 = require("@x402/core/server");
const server_2 = require("@x402/evm/exact/server");
/**
 * Creates and initializes an x402HTTPResourceServer.
 *
 * Follows the upstream pattern: uses facilitatorConfig if provided,
 * otherwise falls back to { url: facilitatorUrl }.
 */
async function createX402Server(config) {
    const facilitator = new server_1.HTTPFacilitatorClient(config.facilitatorConfig ?? { url: config.facilitatorUrl });
    const resourceServer = new server_1.x402ResourceServer(facilitator);
    resourceServer.register(config.network, new server_2.ExactEvmScheme());
    const httpServer = new server_1.x402HTTPResourceServer(resourceServer, config.routes);
    await httpServer.initialize();
    return httpServer;
}
//# sourceMappingURL=x402-server.js.map