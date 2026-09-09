// @ts-check
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { CloudFrontClient, CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');

const s3 = new S3Client({});
const cf = new CloudFrontClient({});
const BUCKET = process.env.BUCKET;
const CF_DISTRIBUTION_ID = process.env.CF_DISTRIBUTION_ID;
// Inline MIME map — this file is deployed as a standalone Lambda (Makefile copies only index.js)
const MIME_TYPES = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};
const DEFAULT_MIME_TYPE = 'application/octet-stream';

function validateEnvVars() {
  if (!BUCKET) throw new Error('Missing required environment variable: BUCKET');
}

function send(event, context, status, reason = context.logStreamName) {
  const physicalResourceId =
    event.PhysicalResourceId ||
    `${event.StackId}/${event.LogicalResourceId}`;
  const body = JSON.stringify({
    Status: status,
    Reason: String(reason).slice(0, 512),
    PhysicalResourceId: physicalResourceId,
    StackId: event.StackId, RequestId: event.RequestId, LogicalResourceId: event.LogicalResourceId, Data: {},
  });
  const parsed = url.parse(event.ResponseURL);
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: parsed.hostname, port: 443, path: parsed.path, method: 'PUT', headers: { 'content-type': '', 'content-length': body.length } }, resolve);
    req.on('error', reject); req.write(body); req.end();
  });
}

function assertSafePath(resolvedPath, baseDir) {
  const normalizedBase = path.resolve(baseDir) + path.sep; // nosemgrep: path-join-resolve-traversal
  const normalizedPath = path.resolve(resolvedPath); // nosemgrep: path-join-resolve-traversal
  if (!normalizedPath.startsWith(normalizedBase) && normalizedPath !== path.resolve(baseDir)) { // nosemgrep: path-join-resolve-traversal
    throw new Error(`Path traversal detected: ${resolvedPath} is outside ${baseDir}`);
  }
}

async function uploadDir(dir, prefix) {
  assertSafePath(dir, dir);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name); // nosemgrep: path-join-resolve-traversal — validated by assertSafePath below
    assertSafePath(full, dir);
    const key = prefix + entry.name;
    if (entry.isDirectory()) {
      await uploadDir(full, key + '/');
    } else {
      const ext = path.extname(entry.name);
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET, Key: key, Body: fs.readFileSync(full),
        ContentType: MIME_TYPES[ext] || DEFAULT_MIME_TYPE,
      }));
    }
  }
}

exports.handler = async (event, context) => {
  console.log(JSON.stringify({ message: 'CFN event received', requestType: event.RequestType }));
  try {
    if (event.RequestType === 'Delete') {
      // Skip content deletion — CloudFormation sends Delete on custom resource
      // replacement (e.g., Lambda version change), which would wipe content
      // that the new Create/Update is about to re-upload. Content is cleaned
      // up naturally when the S3 bucket itself is deleted with the stack.
      console.log(JSON.stringify({ message: 'Skipping content deletion on Delete event' }));
    } else {
      validateEnvVars();
      const assetsDir = path.join(__dirname, 'content-assets');
      await uploadDir(assetsDir, '');
      if (CF_DISTRIBUTION_ID) {
        try {
          await cf.send(new CreateInvalidationCommand({
            DistributionId: CF_DISTRIBUTION_ID,
            InvalidationBatch: {
              CallerReference: 'content-' + Date.now().toString(),
              Paths: { Quantity: 1, Items: ['/*'] },
            },
          }));
        } catch (e) {
          // Uploading the fresh assets is the deploy-critical step. If the
          // invalidation API flakes, CloudFront will refresh normally or can
          // be invalidated manually without rolling back the whole stack.
          console.warn(JSON.stringify({ message: 'CloudFront invalidation failed after upload', error: e.message || String(e) }));
        }
      }
    }
    await send(event, context, 'SUCCESS');
  } catch (e) {
    console.error(JSON.stringify({ message: 'Content deploy failed', error: e.message || String(e) }));
    await send(event, context, 'FAILED', e.message || String(e));
  }
};
