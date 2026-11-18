import { PushChannelRegistryPort } from "#api/modules/notification/push-dispatches/application/ports/push-channel-registry.port";
import {
  type PushMessage,
  PushChannelPort,
  type PushReceiptResult,
  type PushSendResult,
} from "#api/modules/notification/push-dispatches/application/ports/push-channel.port";
import { PushTicketId } from "#api/modules/notification/push-dispatches/domain/push-ticket-id.vo";
import { EXPO_PUSH_CHANNEL_CONFIG } from "#api/modules/notification/push-dispatches/infrastructure/adapters/expo-push-channel.constants";
import { PushChannelRegistryAdapter } from "#api/modules/notification/push-dispatches/infrastructure/adapters/push-channel-registry.adapter";

// 실제 Expo를 부르지 않고 보낸 메시지를 메모리에 남긴다. 결과를 바꿔야 하는 spec은 nextResults로 덮어쓴다
export class FakePushChannel extends PushChannelPort {
  readonly channel = "EXPO";
  // 운영 채널과 같은 receipt·lease 시간으로 확인 구간을 재현한다
  readonly timing = EXPO_PUSH_CHANNEL_CONFIG.timing;
  readonly sentBatches: PushMessage[][] = [];
  nextResults: ((messages: readonly PushMessage[]) => Promise<PushSendResult[]>) | null = null;
  receipts: ((ticketIds: readonly PushTicketId[]) => Promise<PushReceiptResult[]>) | null = null;
  // ticket id는 DB 유니크 컬럼에 남아 앱을 새로 띄우거나 clear해도 겹치지 않게 만든다
  #ticketSequence = 0;

  acceptsToken(): boolean {
    return true;
  }

  async sendBatch(messages: readonly PushMessage[]): Promise<PushSendResult[]> {
    this.sentBatches.push([...messages]);
    if (this.nextResults != null) {
      return this.nextResults(messages);
    }
    return messages.map((message) => ({
      token: message.token,
      status: "accepted",
      ticketId: this.#nextTicketId(),
    }));
  }

  async readReceipts(ticketIds: readonly PushTicketId[]): Promise<PushReceiptResult[]> {
    if (this.receipts != null) {
      return this.receipts(ticketIds);
    }
    return ticketIds.map((ticketId) => ({ ticketId, status: "delivered" }));
  }

  getSentPayloads(): PushMessage[] {
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

  #nextTicketId(): PushTicketId {
    this.#ticketSequence += 1;
    return PushTicketId.reconstitute(`fake-ticket-${Date.now()}-${this.#ticketSequence}`);
  }
}

// 운영과 같은 레지스트리에 대역 채널 하나를 넣는다
export function pushChannelRegistryOf(channel: PushChannelPort): PushChannelRegistryPort {
  return new PushChannelRegistryAdapter([channel]);
}
