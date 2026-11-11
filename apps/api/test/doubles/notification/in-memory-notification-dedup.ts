import type { NotificationType } from "#api/modules/notification/inbox/domain/notification-type.constants";
import {
  NotificationDedupPort,
  type NotificationDedupRecord,
} from "#api/modules/notification/push/application/ports/notification-dedup.port";

function keyOf(type: NotificationType, notificationDate: Temporal.PlainDate): string {
  return `${type}:${notificationDate.toString()}`;
}

// Redis 어댑터처럼 기록·warm-up이 한 번이라도 된 (타입, 날짜)만 warm으로 보고, 아니면 null(cold)을 준다
export class InMemoryNotificationDedup extends NotificationDedupPort {
  readonly #notifiedByKey = new Map<string, Set<string>>();
  failWarmUp = false;

  async recordNotifiedUsers(records: NotificationDedupRecord[]): Promise<void> {
    for (const record of records) {
      this.#add(keyOf(record.type, record.notificationDate), [record.userId]);
    }
  }

  async readKnownRecipients(
    type: NotificationType,
    notificationDate: Temporal.PlainDate,
    userIds: readonly string[],
  ): Promise<Set<string> | null> {
    const notified = this.#notifiedByKey.get(keyOf(type, notificationDate));
    if (notified == null) {
      return null;
    }
    return new Set(userIds.filter((userId) => notified.has(userId)));
  }

  async warmRecipients(
    type: NotificationType,
    notificationDate: Temporal.PlainDate,
    userIds: readonly string[],
  ): Promise<void> {
    if (this.failWarmUp) {
      throw new Error("synthetic dedup warm-up failure");
    }
    this.#add(keyOf(type, notificationDate), userIds);
  }

  isWarm(type: NotificationType, notificationDate: Temporal.PlainDate): boolean {
    return this.#notifiedByKey.has(keyOf(type, notificationDate));
  }

  #add(key: string, userIds: readonly string[]): void {
    const notified = this.#notifiedByKey.get(key) ?? new Set<string>();
    for (const userId of userIds) {
      notified.add(userId);
    }
    this.#notifiedByKey.set(key, notified);
  }
}
