"use strict";
/**
 * x402 on AWS Edge - Shared module entry point
 *
 * This module exports shared types, utilities, and interfaces used across
 * the origin-request, origin-response, and waf-sync Lambda functions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvVars = exports.SsmConfig = exports.HttpStatus = exports.RouteDefaults = exports.BotDefaults = exports.ResponseResultType = exports.RequestResultType = exports.EventType = exports.CacheControl = exports.ContentType = exports.Headers = exports.toLambdaResponse = exports.createX402Middleware = exports.createX402Server = exports.CloudFrontHTTPAdapter = exports.deriveBotName = exports.deriveBotCategory = exports.deriveActorType = exports.emitPaymentRequested = exports.emitSettlement = exports.emitVerification = exports.removeResponseHeader = exports.removeHeader = exports.attachHeader = exports.extractRequest = exports._getCache = exports._setSsmClient = exports._setSsmPrefix = exports._setTtl = exports.resetCache = exports.getEdgeConfig = void 0;
// Re-export config loader
var config_loader_1 = require("./config-loader");
Object.defineProperty(exports, "getEdgeConfig", { enumerable: true, get: function () { return config_loader_1.getEdgeConfig; } });
Object.defineProperty(exports, "resetCache", { enumerable: true, get: function () { return config_loader_1.resetCache; } });
Object.defineProperty(exports, "_setTtl", { enumerable: true, get: function () { return config_loader_1._setTtl; } });
Object.defineProperty(exports, "_setSsmPrefix", { enumerable: true, get: function () { return config_loader_1._setSsmPrefix; } });
Object.defineProperty(exports, "_setSsmClient", { enumerable: true, get: function () { return config_loader_1._setSsmClient; } });
Object.defineProperty(exports, "_getCache", { enumerable: true, get: function () { return config_loader_1._getCache; } });
// Re-export CloudFront HTTP adapter
var cloudfront_adapter_1 = require("./cloudfront-adapter");
Object.defineProperty(exports, "extractRequest", { enumerable: true, get: function () { return cloudfront_adapter_1.extractRequest; } });
Object.defineProperty(exports, "attachHeader", { enumerable: true, get: function () { return cloudfront_adapter_1.attachHeader; } });
Object.defineProperty(exports, "removeHeader", { enumerable: true, get: function () { return cloudfront_adapter_1.removeHeader; } });
Object.defineProperty(exports, "removeResponseHeader", { enumerable: true, get: function () { return cloudfront_adapter_1.removeResponseHeader; } });
// Re-export structured logger and bot header derivation
var logger_1 = require("./logger");
Object.defineProperty(exports, "emitVerification", { enumerable: true, get: function () { return logger_1.emitVerification; } });
Object.defineProperty(exports, "emitSettlement", { enumerable: true, get: function () { return logger_1.emitSettlement; } });
Object.defineProperty(exports, "emitPaymentRequested", { enumerable: true, get: function () { return logger_1.emitPaymentRequested; } });
Object.defineProperty(exports, "deriveActorType", { enumerable: true, get: function () { return logger_1.deriveActorType; } });
Object.defineProperty(exports, "deriveBotCategory", { enumerable: true, get: function () { return logger_1.deriveBotCategory; } });
Object.defineProperty(exports, "deriveBotName", { enumerable: true, get: function () { return logger_1.deriveBotName; } });
// Re-export CloudFront HTTP adapter class
var cloudfront_http_adapter_1 = require("./cloudfront-http-adapter");
Object.defineProperty(exports, "CloudFrontHTTPAdapter", { enumerable: true, get: function () { return cloudfront_http_adapter_1.CloudFrontHTTPAdapter; } });
// Re-export x402 server factory and middleware
var x402_server_1 = require("./x402-server");
Object.defineProperty(exports, "createX402Server", { enumerable: true, get: function () { return x402_server_1.createX402Server; } });
var x402_middleware_1 = require("./x402-middleware");
Object.defineProperty(exports, "createX402Middleware", { enumerable: true, get: function () { return x402_middleware_1.createX402Middleware; } });
// Re-export response utilities
var to_lambda_response_1 = require("./to-lambda-response");
Object.defineProperty(exports, "toLambdaResponse", { enumerable: true, get: function () { return to_lambda_response_1.toLambdaResponse; } });
// Re-export constants
var constants_1 = require("./constants");
Object.defineProperty(exports, "Headers", { enumerable: true, get: function () { return constants_1.Headers; } });
Object.defineProperty(exports, "ContentType", { enumerable: true, get: function () { return constants_1.ContentType; } });
Object.defineProperty(exports, "CacheControl", { enumerable: true, get: function () { return constants_1.CacheControl; } });
Object.defineProperty(exports, "EventType", { enumerable: true, get: function () { return constants_1.EventType; } });
Object.defineProperty(exports, "RequestResultType", { enumerable: true, get: function () { return constants_1.RequestResultType; } });
Object.defineProperty(exports, "ResponseResultType", { enumerable: true, get: function () { return constants_1.ResponseResultType; } });
Object.defineProperty(exports, "BotDefaults", { enumerable: true, get: function () { return constants_1.BotDefaults; } });
Object.defineProperty(exports, "RouteDefaults", { enumerable: true, get: function () { return constants_1.RouteDefaults; } });
Object.defineProperty(exports, "HttpStatus", { enumerable: true, get: function () { return constants_1.HttpStatus; } });
Object.defineProperty(exports, "SsmConfig", { enumerable: true, get: function () { return constants_1.SsmConfig; } });
Object.defineProperty(exports, "EnvVars", { enumerable: true, get: function () { return constants_1.EnvVars; } });
//# sourceMappingURL=index.js.map