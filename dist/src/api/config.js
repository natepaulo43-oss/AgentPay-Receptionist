"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USDC_ASSET_VERSION = exports.USDC_ASSET_NAME = exports.USDC_ASSET_ADDRESS = exports.APPOINTMENT_TIME = exports.HOLD_SLOT_DESCRIPTION = exports.HOLD_SLOT_AMOUNT_ATOMIC = exports.HOLD_SLOT_PRICE = exports.CHAT_RATE_WINDOW_MS = exports.CHAT_RATE_LIMIT = exports.MAX_BODY_BYTES = exports.ALLOW_UNVERIFIED_PAYMENT_HEADERS = exports.TABLE_NAME = exports.PAY_TO_ADDRESS = exports.PAYMENT_PROTOCOL = exports.NETWORK_LABEL = exports.NETWORK = exports.BUSINESS_NAME = exports.BUSINESS_ID = void 0;
exports.nowIso = nowIso;
exports.makeId = makeId;
exports.BUSINESS_ID = 'miami-elite-auto-detail';
exports.BUSINESS_NAME = 'Miami Elite Auto Detail';
exports.NETWORK = process.env.X402_NETWORK ?? 'eip155:84532';
exports.NETWORK_LABEL = exports.NETWORK === 'eip155:8453' ? 'Base Mainnet' : 'Base Sepolia';
exports.PAYMENT_PROTOCOL = 'x402';
exports.PAY_TO_ADDRESS = process.env.PAY_TO_ADDRESS ?? '0x0000000000000000000000000000000000000402';
exports.TABLE_NAME = process.env.AGENTPAY_TABLE_NAME ?? process.env.TABLE_NAME;
exports.ALLOW_UNVERIFIED_PAYMENT_HEADERS = process.env.AGENTPAY_ALLOW_UNVERIFIED_PAYMENT_HEADERS === 'true';
exports.MAX_BODY_BYTES = 50 * 1024;
exports.CHAT_RATE_LIMIT = 30;
exports.CHAT_RATE_WINDOW_MS = 60 * 1000;
exports.HOLD_SLOT_PRICE = '5.00';
exports.HOLD_SLOT_AMOUNT_ATOMIC = '5000000';
exports.HOLD_SLOT_DESCRIPTION = 'Hold a priority appointment slot with a local business receptionist.';
exports.APPOINTMENT_TIME = '2026-05-05T16:30:00-04:00';
const USDC_ASSETS = {
    'eip155:8453': {
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        name: 'USD Coin',
        version: '2',
    },
    'eip155:84532': {
        address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        name: 'USDC',
        version: '2',
    },
};
const DEFAULT_USDC_ASSET = USDC_ASSETS['eip155:84532'];
exports.USDC_ASSET_ADDRESS = USDC_ASSETS[exports.NETWORK]?.address ?? DEFAULT_USDC_ASSET.address;
exports.USDC_ASSET_NAME = USDC_ASSETS[exports.NETWORK]?.name ?? DEFAULT_USDC_ASSET.name;
exports.USDC_ASSET_VERSION = USDC_ASSETS[exports.NETWORK]?.version ?? DEFAULT_USDC_ASSET.version;
function nowIso() {
    return new Date().toISOString();
}
function makeId(prefix) {
    const random = Math.random().toString(36).slice(2, 10);
    return `${prefix}_${Date.now().toString(36)}_${random}`;
}
//# sourceMappingURL=config.js.map