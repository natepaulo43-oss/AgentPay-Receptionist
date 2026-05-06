import type { Lead, PaidAction, PaymentEvent, PersistKind, TimelineStatus } from './types';
export declare const memory: {
    leads: Lead[];
    payments: PaidAction[];
    events: PaymentEvent[];
};
export declare function eventFor(actionId: string, status: TimelineStatus, detail: string, amount?: string): PaymentEvent;
export declare function safePersist(kind: PersistKind, id: string, item: unknown): Promise<void>;
export declare function getStoredLeads(): Promise<Lead[]>;
export declare function getStoredPayments(): Promise<{
    payments: PaidAction[];
    events: PaymentEvent[];
}>;
export declare function resetStoredData(): Promise<{
    memoryCleared: boolean;
    dynamoDeleted: number;
    dynamoError?: string;
}>;
//# sourceMappingURL=storage.d.ts.map