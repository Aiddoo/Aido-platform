import { AdminBroadcastNotifierPort } from "#api/modules/operations/broadcasts/application/ports/admin-broadcast-notifier.port";
import type { AdminBroadcastMessage } from "#api/modules/operations/broadcasts/application/read-models/broadcast-message.read-model";

// 알림을 만들지 않고 배치로 받은 메시지만 기록한다
export class RecordingAdminBroadcastNotifier extends AdminBroadcastNotifierPort {
  readonly batches: (readonly AdminBroadcastMessage[])[] = [];

  get messages(): AdminBroadcastMessage[] {
    return this.batches.flat();
  }

  async sendBatch(messages: readonly AdminBroadcastMessage[]): Promise<{ count: number }> {
    this.batches.push(messages);
    return { count: messages.length };
  }
}
