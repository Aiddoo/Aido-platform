import type {
  PushPayload,
  PushProvider,
  PushReceiptResult,
  PushResult,
} from "#api/modules/notification/application/ports/delivery/push-provider.port";

/** 실제 Expo를 부르지 않고 보낸 payload를 메모리에 남긴다. */
export class FakePushProvider implements PushProvider {
  readonly name = "fake";
  #sentPayloads: PushPayload[] = [];
  #ticketSequence = 0;

  validateToken(token: string): boolean {
    return token.startsWith("ExponentPushToken[") || token.startsWith("fake-");
  }

  async sendBatch(payloads: readonly PushPayload[]): Promise<PushResult[]> {
    this.#sentPayloads.push(...payloads);
    return payloads.map((payload) => ({
      token: payload.token,
      status: "accepted",
      ticketId: this.#nextTicketId(),
    }));
  }

  async getReceipts(ticketIds: readonly string[]): Promise<PushReceiptResult[]> {
    return ticketIds.map((ticketId) => ({ ticketId, status: "delivered" }));
  }

  getSentPayloads(): PushPayload[] {
    return [...this.#sentPayloads];
  }

  getSentCount(): number {
    return this.#sentPayloads.length;
  }

  clear(): void {
    this.#sentPayloads = [];
    this.#ticketSequence = 0;
  }

  #nextTicketId(): string {
    this.#ticketSequence += 1;
    return `fake-ticket-${Date.now()}-${this.#ticketSequence}`;
  }
}
