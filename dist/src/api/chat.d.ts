import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { ChatResponse } from './types';
type ChatRole = 'user' | 'assistant';
interface ChatMessage {
    role: ChatRole;
    text: string;
}
interface ChatInput {
    message: string;
    conversationHistory: ChatMessage[];
}
export declare function enforceChatRateLimit(event: APIGatewayProxyEvent): boolean;
export declare function parseConversationHistory(value: unknown): ChatMessage[];
export declare function chatResponseFor(input: ChatInput): ChatResponse;
export {};
//# sourceMappingURL=chat.d.ts.map