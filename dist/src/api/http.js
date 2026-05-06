"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lowerHeaders = lowerHeaders;
exports.json = json;
exports.isAllowedOrigin = isAllowedOrigin;
exports.parseJsonBody = parseJsonBody;
exports.stringField = stringField;
const config_1 = require("./config");
function lowerHeaders(headers) {
    const normalized = {};
    for (const [key, value] of Object.entries(headers ?? {})) {
        if (value !== undefined) {
            normalized[key.toLowerCase()] = value;
        }
    }
    return normalized;
}
function json(statusCode, body, origin, extraHeaders = {}) {
    return {
        statusCode,
        headers: {
            'content-type': 'application/json',
            'cache-control': 'no-store',
            'access-control-allow-origin': origin ?? '*',
            'access-control-allow-headers': 'content-type,x-payment,x-payment-response,payment-signature',
            'access-control-allow-methods': 'GET,POST,OPTIONS',
            'access-control-max-age': '600',
            ...extraHeaders,
        },
        body: JSON.stringify(body, null, 2),
    };
}
function isAllowedOrigin(origin) {
    if (!origin)
        return true;
    try {
        const parsed = new URL(origin);
        if (parsed.hostname.endsWith('.cloudfront.net'))
            return true;
        return allowedOrigins().includes(parsed.origin);
    }
    catch {
        return false;
    }
}
function parseJsonBody(event) {
    if (!event.body)
        return {};
    const raw = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf8')
        : event.body;
    if (Buffer.byteLength(raw, 'utf8') > config_1.MAX_BODY_BYTES) {
        const error = new Error('Request body exceeds 50kb limit.');
        error.name = 'PayloadTooLarge';
        throw error;
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};
}
function stringField(value, fallback = '') {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}
function allowedOrigins() {
    return [
        'http://localhost:5173',
        'http://localhost:8787',
        'http://127.0.0.1:8787',
        ...(process.env.ALLOWED_ORIGIN
            ? process.env.ALLOWED_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
            : []),
    ];
}
//# sourceMappingURL=http.js.map