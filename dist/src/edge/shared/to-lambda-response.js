"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toLambdaResponse = toLambdaResponse;
const http_1 = require("@x402/core/http");
const constants_1 = require("./constants");
function toLambdaResponse(instructions) {
    const headers = {};
    for (const [key, value] of Object.entries(instructions.headers)) {
        headers[key.toLowerCase()] = [{ key, value }];
    }
    let body;
    if (instructions.headers[constants_1.Headers.PAYMENT_REQUIRED]) {
        const decoded = (0, http_1.decodePaymentRequiredHeader)(instructions.headers[constants_1.Headers.PAYMENT_REQUIRED]);
        body = JSON.stringify(decoded);
        headers[constants_1.Headers.CONTENT_TYPE] = [{ key: 'Content-Type', value: constants_1.ContentType.JSON }];
    }
    else if (instructions.body !== undefined) {
        body = typeof instructions.body === 'string'
            ? instructions.body
            : JSON.stringify(instructions.body);
    }
    else {
        body = '';
    }
    if (!headers[constants_1.Headers.CACHE_CONTROL]) {
        headers[constants_1.Headers.CACHE_CONTROL] = [{ key: 'Cache-Control', value: constants_1.CacheControl.NO_STORE }];
    }
    return {
        status: String(instructions.status),
        statusDescription: instructions.status === constants_1.HttpStatus.PAYMENT_REQUIRED ? constants_1.HttpStatus.PAYMENT_REQUIRED_DESCRIPTION : constants_1.HttpStatus.ERROR_DESCRIPTION,
        headers,
        body,
    };
}
//# sourceMappingURL=to-lambda-response.js.map