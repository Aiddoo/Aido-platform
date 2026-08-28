import type { PushReceiptResult } from "./push-provider.port";

export const PUSH_RECEIPT_REPOSITORY = Symbol("PUSH_RECEIPT_REPOSITORY");

export interface PendingPushReceipt {
	readonly ticketId: string;
	readonly token: string;
}

/** Expo ticket의 최종 receipt 상태를 조회·반영하는 포트. */
export interface PushReceiptRepositoryPort {
	findPendingPushReceipts(limit: number): Promise<PendingPushReceipt[]>;
	recordPushReceipts(results: PushReceiptResult[]): Promise<string[]>;
}
