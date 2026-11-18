import {
  NotificationDeduplicationPort,
  type NotificationDeduplicationEntry,
} from "#api/modules/notification/notifications/application/ports/notification-deduplication.port";
import type { NotificationType } from "#api/modules/notification/shared/domain/notification-type.constants";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

function keyOf(type: NotificationType, notificationDate: Temporal.PlainDate): string {
  return `${type}:${notificationDate.toString()}`;
}

// Redis 어댑터처럼 기록·warm-up이 한 번이라도 된 (타입, 날짜)만 warm으로 보고, 아니면 null(cold)을 준다
export class InMemoryNotificationDeduplication extends NotificationDeduplicationPort {
  readonly #notifiedByKey = new Map<string, Set<string>>();
  failWarmUp = false;

  async recordNotifiedUsers(records: NotificationDeduplicationEntry[]): Promise<void> {
    for (const record of records) {
      this.#add(keyOf(record.type, record.notificationDate), [record.userId.value]);
    }
  }

  async readKnownRecipients(
    type: NotificationType,
    notificationDate: Temporal.PlainDate,
    userIds: readonly UserId[],
  ): Promise<Set<string> | null> {
    const notified = this.#notifiedByKey.get(keyOf(type, notificationDate));
    if (notified == null) {
      return null;
    }
    return new Set(userIds.map((userId) => userId.value).filter((userId) => notified.has(userId)));
  }

  async warmRecipients(
    type: NotificationType,
    notificationDate: Temporal.PlainDate,
    userIds: readonly UserId[],
  ): Promise<void> {
    if (this.failWarmUp) {
      throw new Error("synthetic dedup warm-up failure");
    }
    this.#add(
      keyOf(type, notificationDate),
      userIds.map((userId) => userId.value),
    );
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
