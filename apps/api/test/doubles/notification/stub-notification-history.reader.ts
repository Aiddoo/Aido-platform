import type { NotificationHistoryReader } from "#api/modules/notification/inbox/application/notification-history.reader";
import type { FindAlreadyNotifiedUserIdsQuery } from "#api/modules/notification/inbox/application/ports/notification-history.reader.port";
import type { NotificationType } from "#api/modules/notification/inbox/domain/notification-type.constants";

function keyOf(type: NotificationType, notificationDate: Temporal.PlainDate): string {
  return `${type}:${notificationDate.toString()}`;
}

// 알림 타입별로 이미 받은 사용자를 두고 물어본 조회를 남긴다. 날짜를 주지 않으면 모든 날에 받은 것으로 본다
export class StubNotificationHistoryReader implements Pick<
  NotificationHistoryReader,
  "findAlreadyNotifiedUserIds"
> {
  readonly queries: FindAlreadyNotifiedUserIdsQuery[] = [];
  readonly #notifiedByKey = new Map<string, Set<string>>();

  notified(
    type: NotificationType,
    userIds: readonly string[],
    notificationDate?: Temporal.PlainDate,
  ): void {
    const key = notificationDate == null ? type : keyOf(type, notificationDate);
    const users = this.#notifiedByKey.get(key) ?? new Set<string>();
    for (const userId of userIds) {
      users.add(userId);
    }
    this.#notifiedByKey.set(key, users);
  }

  async findAlreadyNotifiedUserIds(query: FindAlreadyNotifiedUserIdsQuery): Promise<Set<string>> {
    this.queries.push({ ...query, userIds: [...query.userIds] });
    const notified = new Set([
      ...(this.#notifiedByKey.get(query.type) ?? []),
      ...(this.#notifiedByKey.get(keyOf(query.type, query.notificationDate)) ?? []),
    ]);
    return new Set(query.userIds.filter((userId) => notified.has(userId)));
  }
}
