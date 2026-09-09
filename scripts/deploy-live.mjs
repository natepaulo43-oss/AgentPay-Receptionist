#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const stackName = process.env.STACK_NAME || 'agentpay-receptionist';
const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const payToAddress = process.env.PAY_TO_ADDRESS;
const network = process.env.NETWORK || 'eip155:84532';
const facilitatorType = process.env.FACILITATOR_TYPE || 'x402.org';
const demoBuyerPrivateKey = process.env.DEMO_BUYER_PRIVATE_KEY;
const demoPublicBaseUrl = process.env.AGENTPAY_PUBLIC_BASE_URL;
const routeConfig = JSON.stringify(JSON.parse(readFileSync(new URL('../config/default-routes.json', import.meta.url), 'utf8')));

if (!payToAddress) {
  console.error('Missing PAY_TO_ADDRESS. Example: PAY_TO_ADDRESS=0x... npm run sam:deploy:live');
  process.exit(1);
}

const parameterOverrides = [
  `PayToAddress=${payToAddress}`,
  `Network=${network}`,
  `FacilitatorType=${facilitatorType}`,
];

if (demoBuyerPrivateKey) {
  parameterOverrides.push(`DemoBuyerPrivateKey=${demoBuyerPrivateKey}`);
}

if (demoPublicBaseUrl) {
  parameterOverrides.push(`DemoPublicBaseUrl=${demoPublicBaseUrl}`);
}

run('sam', [
  'deploy',
  '--stack-name', stackName,
  '--region', region,
  '--capabilities', 'CAPABILITY_NAMED_IAM',
  '--resolve-s3',
  '--no-fail-on-empty-changeset',
  '--parameter-overrides',
  ...parameterOverrides,
]);

run('aws', [
  'ssm', 'put-parameter',
  '--name', `/x402-edge/${stackName}/config/routes`,
  '--type', 'String',
  '--value', routeConfig,
  '--overwrite',
  '--region', region,
]);

run('aws', [
  'lambda', 'invoke',
  '--function-name', `${stackName}-waf-sync`,
  '--region', region,
  '/tmp/agentpay-waf-sync-response.json',
]);

console.log('\nLive deploy complete. SSM/WAF route pricing was synced from config/default-routes.json.');

function run(command, args) {
  console.log(`\n$ ${command} ${args.map(maskSecretArg).join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
}

function maskSecretArg(arg) {
  return arg.startsWith('DemoBuyerPrivateKey=') ? 'DemoBuyerPrivateKey=<hidden>' : arg;
}
