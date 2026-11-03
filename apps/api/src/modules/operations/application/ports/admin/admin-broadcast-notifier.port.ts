import type { AdminBroadcastMessage } from "../../read-models/admin/broadcast-message.read-model.js";

export const ADMIN_BROADCAST_NOTIFIER = Symbol("ADMIN_BROADCAST_NOTIFIER");

/** 알림과 발송 outbox를 한 배치로 만든다. 활성 UNIT_OF_WORK가 있으면 그 안에서 커밋된다. */
export interface AdminBroadcastNotifierPort {
  sendBatch(messages: AdminBroadcastMessage[]): Promise<{ count: number }>;
}
