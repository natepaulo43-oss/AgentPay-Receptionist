import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { PaidActionType } from './types';
export declare function handleHoldSlot(event: APIGatewayProxyEvent, origin: string | undefined): Promise<APIGatewayProxyResult>;
export declare function handlePaidStub(event: APIGatewayProxyEvent, origin: string | undefined, type: PaidActionType): Promise<APIGatewayProxyResult>;
//# sourceMappingURL=paidActions.d.ts.map