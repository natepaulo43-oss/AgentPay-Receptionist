export const BUSINESS_ID = 'miami-elite-auto-detail';
export const BUSINESS_NAME = 'Miami Elite Auto Detail';
export const NETWORK = process.env.X402_NETWORK ?? 'eip155:84532';
export const NETWORK_LABEL = NETWORK === 'eip155:8453' ? 'Base Mainnet' : 'Base Sepolia';
export const PAYMENT_PROTOCOL = 'x402';
export const PAY_TO_ADDRESS =
  process.env.PAY_TO_ADDRESS ?? '0x0000000000000000000000000000000000000402';
export const TABLE_NAME = process.env.AGENTPAY_TABLE_NAME ?? process.env.TABLE_NAME;
export const ALLOW_UNVERIFIED_PAYMENT_HEADERS =
  process.env.AGENTPAY_ALLOW_UNVERIFIED_PAYMENT_HEADERS === 'true';
export const MAX_BODY_BYTES = 50 * 1024;
export const CHAT_RATE_LIMIT = 30;
export const CHAT_RATE_WINDOW_MS = 60 * 1000;
export const HOLD_SLOT_PRICE = '5.00';
export const HOLD_SLOT_AMOUNT_ATOMIC = '5000000';
export const HOLD_SLOT_DESCRIPTION =
  'Hold a priority appointment slot with a local business receptionist.';
export const APPOINTMENT_TIME = '2026-05-05T16:30:00-04:00';

const USDC_ASSETS: Record<string, { address: string; name: string; version: string }> = {
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
export const USDC_ASSET_ADDRESS = USDC_ASSETS[NETWORK]?.address ?? DEFAULT_USDC_ASSET.address;
export const USDC_ASSET_NAME = USDC_ASSETS[NETWORK]?.name ?? DEFAULT_USDC_ASSET.name;
export const USDC_ASSET_VERSION = USDC_ASSETS[NETWORK]?.version ?? DEFAULT_USDC_ASSET.version;

export function nowIso(): string {
  return new Date().toISOString();
}

export function makeId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}
