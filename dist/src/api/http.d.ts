import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
export declare function lowerHeaders(headers: APIGatewayProxyEvent['headers']): Record<string, string>;
export declare function json(statusCode: number, body: unknown, origin?: string, extraHeaders?: Record<string, string>): APIGatewayProxyResult;
export declare function isAllowedOrigin(origin: string | undefined): boolean;
export declare function parseJsonBody(event: APIGatewayProxyEvent): Record<string, unknown>;
export declare function stringField(value: unknown, fallback?: string): string;
//# sourceMappingURL=http.d.ts.map