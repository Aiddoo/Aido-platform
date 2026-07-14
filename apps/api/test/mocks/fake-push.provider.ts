import type {
	BatchPushResult,
	PushPayload,
	PushProvider,
	PushReceiptResult,
	PushResult,
} from "@/notification";

/**
 * 테스트용 FakePushProvider
 *
 * 실제 Expo Push를 호출하지 않고, 발송된 알림을 메모리에 저장합니다.
 */
export class FakePushProvider implements PushProvider {
	readonly name = "fake";
	private _sentPayloads: PushPayload[] = [];

	validateToken(token: string): boolean {
		return token.startsWith("ExponentPushToken[") || token.startsWith("fake-");
	}

	async send(payload: PushPayload): Promise<PushResult> {
		this._sentPayloads.push(payload);
		return {
			token: payload.token,
			success: true,
			ticketId: `fake-ticket-${Date.now()}`,
		};
	}

	async sendBatch(payloads: PushPayload[]): Promise<BatchPushResult> {
		this._sentPayloads.push(...payloads);
		const results: PushResult[] = payloads.map((payload) => ({
			token: payload.token,
			success: true,
			ticketId: `fake-ticket-${Date.now()}`,
		}));
		return {
			total: payloads.length,
			successCount: payloads.length,
			failureCount: 0,
			results,
			invalidTokens: [],
		};
	}

	async getReceipts(ticketIds: string[]): Promise<PushReceiptResult[]> {
		return ticketIds.map((ticketId) => ({ ticketId, delivered: true }));
	}

	getSentPayloads(): PushPayload[] {
		return [...this._sentPayloads];
	}

	getSentCount(): number {
		return this._sentPayloads.length;
	}

	clear(): void {
		this._sentPayloads = [];
	}
}
