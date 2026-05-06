import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { ChatResponse } from './types';
export declare function enforceChatRateLimit(event: APIGatewayProxyEvent): boolean;
export declare function chatResponseFor(message: string): ChatResponse;
//# sourceMappingURL=chat.d.ts.map