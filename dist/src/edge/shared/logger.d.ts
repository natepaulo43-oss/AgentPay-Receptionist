/**
 * x402 on AWS Edge - Structured Logger for Payment Events
 *
 * Emits structured JSON log entries to CloudWatch Logs for payment
 * verification and settlement events. Uses `console.log(JSON.stringify(...))`
 * so that CloudWatch Logs Insights can query individual fields.
 *
 * When Lambda advanced logging is enabled (LogFormat: JSON), the runtime
 * automatically injects `timestamp`, `level`, and `requestId` into each
 * log entry and merges application JSON fields into the envelope.
 * Failure events use `console.error` (level: ERROR) so that Lambda's
 * ApplicationLogLevel filtering can surface them independently.
 *
 */
export interface LogContext {
    path: string;
    price: string;
    clientIp: string;
    botHeaders: Record<string, string>;
    network: string;
}
export declare function deriveActorType(botHeaders: Record<string, string>): string;
export declare function deriveBotCategory(botHeaders: Record<string, string>): string;
export declare function deriveBotOrganization(botHeaders: Record<string, string>): string;
export declare function deriveBotName(botHeaders: Record<string, string>): string;
export declare function emitPassthrough(path: string, clientIp: string, botHeaders: Record<string, string>): void;
export declare function emitPaymentRequested(ctx: LogContext): void;
export declare function emitVerification(ctx: LogContext, result: 'success' | 'failure', error: string | null): void;
export declare function emitSettlement(ctx: LogContext, result: 'success' | 'failure', opts?: {
    transactionHash?: string | null;
    error?: string | null;
}): void;
//# sourceMappingURL=logger.d.ts.map