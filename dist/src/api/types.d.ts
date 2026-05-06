export type PaidActionType = 'hold_slot' | 'quote_request' | 'priority_callback';
export type PaymentStatus = 'payment_required' | 'verified' | 'settled' | 'simulated';
export type TimelineStatus = 'REQUEST_RECEIVED' | 'PAYMENT_REQUIRED_402' | 'PAYMENT_SIGNATURE_RECEIVED' | 'PAYMENT_VERIFIED' | 'ACTION_COMPLETED' | 'LEAD_CREATED';
export interface PaidAction {
    actionId: string;
    businessId: string;
    sessionId: string;
    type: PaidActionType;
    amount: string;
    currency: 'USDC';
    network: string;
    paymentStatus: PaymentStatus;
    createdAt: string;
    updatedAt: string;
}
export interface Lead {
    leadId: string;
    businessId: string;
    customerName: string;
    customerPhone: string;
    request: string;
    service: string;
    vehicle: string;
    appointmentTime: string;
    paidActionId: string;
    status: 'paid_slot_held' | 'pending';
    transcriptSnippet: string;
    createdAt: string;
}
export interface PaymentEvent {
    eventId: string;
    actionId: string;
    businessId: string;
    status: TimelineStatus;
    detail: string;
    timestamp: string;
    protocol: 'x402';
    network: string;
    amount?: string;
}
export interface ChatResponse {
    reply: string;
    intent: string;
    requiresPayment: boolean;
    paidAction: null | {
        type: PaidActionType;
        endpoint: string;
        price: string;
        currency: 'USDC';
        network: string;
        protocol: 'x402';
        reason: string;
    };
    leadFields: Record<string, string | null>;
}
export type PersistKind = 'LEAD' | 'PAYMENT' | 'PAYMENT_EVENT';
//# sourceMappingURL=types.d.ts.map