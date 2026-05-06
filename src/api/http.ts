import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { MAX_BODY_BYTES } from './config';

export function lowerHeaders(headers: APIGatewayProxyEvent['headers']): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (value !== undefined) {
      normalized[key.toLowerCase()] = value;
    }
  }
  return normalized;
}

export function json(
  statusCode: number,
  body: unknown,
  origin?: string,
  extraHeaders: Record<string, string> = {},
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'access-control-allow-origin': origin ?? '*',
      'access-control-allow-headers':
        'content-type,x-payment,x-payment-response,payment-signature',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-max-age': '600',
      ...extraHeaders,
    },
    body: JSON.stringify(body, null, 2),
  };
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    if (parsed.hostname.endsWith('.cloudfront.net')) return true;
    return allowedOrigins().includes(parsed.origin);
  } catch {
    return false;
  }
}

export function parseJsonBody(event: APIGatewayProxyEvent): Record<string, unknown> {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    const error = new Error('Request body exceeds 50kb limit.');
    error.name = 'PayloadTooLarge';
    throw error;
  }
  const parsed: unknown = JSON.parse(raw);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

export function stringField(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function allowedOrigins(): string[] {
  return [
    'http://localhost:5173',
    'http://localhost:8787',
    'http://127.0.0.1:8787',
    ...(process.env.ALLOWED_ORIGIN
      ? process.env.ALLOWED_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
      : []),
  ];
}
