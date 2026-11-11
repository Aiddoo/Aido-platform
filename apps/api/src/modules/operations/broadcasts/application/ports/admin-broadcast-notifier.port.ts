import type { AdminBroadcastMessage } from "../read-models/broadcast-message.read-model.js";

export abstract class AdminBroadcastNotifierPort {
  /** 알림과 발송 outbox를 한 배치로 만든다. 활성 UoW가 있으면 그 안에서 커밋된다. */
  abstract sendBatch(messages: readonly AdminBroadcastMessage[]): Promise<{ count: number }>;
}
