import {
  type PushPayload,
  PushProviderPort,
  type PushReceiptResult,
  type PushResult,
} from "#api/modules/notification/push/application/ports/push-provider.port";

// 실제 Expo를 부르지 않고 보낸 payload를 메모리에 남긴다. 결과를 바꿔야 하는 spec은 nextResults로 덮어쓴다
export class FakePushProvider extends PushProviderPort {
  readonly name = "fake";
  readonly sentBatches: PushPayload[][] = [];
  nextResults: ((payloads: readonly PushPayload[]) => Promise<PushResult[]>) | null = null;
  receipts: ((ticketIds: readonly string[]) => Promise<PushReceiptResult[]>) | null = null;
  // ticket id는 DB 유니크 컬럼에 남아 앱을 새로 띄우거나 clear해도 겹치지 않게 만든다
  #ticketSequence = 0;

  validateToken(token: string): boolean {
    return token.startsWith("ExponentPushToken[") || token.startsWith("fake-");
  }

  async sendBatch(payloads: readonly PushPayload[]): Promise<PushResult[]> {
    this.sentBatches.push([...payloads]);
    if (this.nextResults != null) {
      return this.nextResults(payloads);
    }
    return payloads.map((payload) => ({
      token: payload.token,
      status: "accepted",
      ticketId: this.#nextTicketId(),
    }));
  }

  async getReceipts(ticketIds: readonly string[]): Promise<PushReceiptResult[]> {
    if (this.receipts != null) {
      return this.receipts(ticketIds);
    }
    return ticketIds.map((ticketId) => ({ ticketId, status: "delivered" }));
  }

  getSentPayloads(): PushPayload[] {
    return this.sentBatches.flat();
  }

  getSentCount(): number {
    return this.getSentPayloads().length;
  }

  clear(): void {
    this.sentBatches.splice(0);
    this.nextResults = null;
    this.receipts = null;
  }

  #nextTicketId(): string {
    this.#ticketSequence += 1;
    return `fake-ticket-${Date.now()}-${this.#ticketSequence}`;
  }
}
