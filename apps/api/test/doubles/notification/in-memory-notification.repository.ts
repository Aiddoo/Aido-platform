import { isPlainObject, uniq } from "es-toolkit";

import type {
  ListInboxNotificationsQuery,
  NotificationInboxReaderPort,
} from "#api/modules/notification/inbox/application/ports/notification-inbox.reader.port";
import type { NotificationRepositoryPort } from "#api/modules/notification/inbox/application/ports/notification.repository.port";
import type { InboxNotification } from "#api/modules/notification/inbox/application/read-models/inbox-notification.read-model";
import type { NotificationId } from "#api/modules/notification/inbox/domain/notification-id.vo";
import type { NotificationType } from "#api/modules/notification/inbox/domain/notification-type.constants";
import { Notification } from "#api/modules/notification/inbox/domain/notification.aggregate";
import { instantFromDate, instantToDate } from "#api/shared/domain/time/instant";

type InboxRepositoryMethods =
  | "findById"
  | "markAsRead"
  | "markAsOpened"
  | "markAllAsRead"
  | "deleteNotificationsByActorId";

// Drizzle 저장소와 같은 순서(createdAt·id 내림차순)로 나열한다
function compareListOrder(left: InboxNotification, right: InboxNotification): number {
  return right.createdAt.getTime() - left.createdAt.getTime() || right.id - left.id;
}

function isOfTypes(row: InboxNotification, types: readonly NotificationType[] | undefined) {
  return types == null || types.includes(row.type);
}

function senderIdOf(row: InboxNotification): unknown {
  return isPlainObject(row.metadata) ? row.metadata.senderId : undefined;
}

// 알림함 행과 같은 모양으로 저장해 쓰기 뒤 목록·미읽음 수를 그대로 읽어 볼 수 있게 한다
export class InMemoryNotificationRepository
  implements
    Pick<NotificationRepositoryPort, InboxRepositoryMethods>,
    Pick<NotificationInboxReaderPort, "listByUser" | "countUnread">
{
  readonly #rows = new Map<number, InboxNotification>();

  constructor(rows: readonly InboxNotification[] = []) {
    for (const row of rows) {
      this.#rows.set(row.id, row);
    }
  }

  rowOf(id: number): InboxNotification | undefined {
    return this.#rows.get(id);
  }

  async findById(notificationId: NotificationId): Promise<Notification | null> {
    const row = this.#rows.get(notificationId.value);
    if (row == null) {
      return null;
    }
    return Notification.reconstitute({
      id: row.id,
      userId: row.userId,
      type: row.type,
      title: row.title,
      body: row.body,
      copyKey: row.copyKey,
      copyFacts: isPlainObject(row.copyFacts) ? row.copyFacts : null,
      isRead: row.isRead,
      readAt: row.readAt == null ? null : instantFromDate(row.readAt),
      openedAt: row.openedAt == null ? null : instantFromDate(row.openedAt),
      createdAt: instantFromDate(row.createdAt),
    });
  }

  async markAsRead(notification: Notification): Promise<boolean> {
    const { id, userId, readAt } = notification.toPrimitives();
    const row = this.#rows.get(id);
    if (row == null || row.userId !== userId || row.isRead) {
      return false;
    }
    this.#rows.set(id, {
      ...row,
      isRead: true,
      readAt: readAt == null ? null : instantToDate(readAt),
    });
    return true;
  }

  async markAsOpened(
    notificationId: NotificationId,
    userId: string,
    now: Temporal.Instant,
  ): Promise<boolean> {
    const row = this.#rows.get(notificationId.value);
    if (row == null || row.userId !== userId || row.openedAt != null) {
      return false;
    }
    const openedAt = instantToDate(now);
    this.#rows.set(row.id, { ...row, openedAt, isRead: true, readAt: openedAt });
    return true;
  }

  async markAllAsRead(
    userId: string,
    types: readonly NotificationType[] | undefined,
    now: Temporal.Instant,
  ): Promise<{ count: number }> {
    const targets = [...this.#rows.values()].filter(
      (row) => row.userId === userId && !row.isRead && isOfTypes(row, types),
    );
    for (const row of targets) {
      this.#rows.set(row.id, { ...row, isRead: true, readAt: instantToDate(now) });
    }
    return { count: targets.length };
  }

  async deleteNotificationsByActorId(
    actorId: string,
  ): Promise<{ count: number; affectedUserIds: string[] }> {
    const deleted = [...this.#rows.values()].filter(
      (row) => row.friendId === actorId || senderIdOf(row) === actorId,
    );
    for (const row of deleted) {
      this.#rows.delete(row.id);
    }
    return { count: deleted.length, affectedUserIds: uniq(deleted.map((row) => row.userId)) };
  }

  async listByUser(query: ListInboxNotificationsQuery): Promise<InboxNotification[]> {
    const visible = [...this.#rows.values()]
      .filter(
        (row) =>
          row.userId === query.userId &&
          (!query.unreadOnly || !row.isRead) &&
          isOfTypes(row, query.types),
      )
      .toSorted(compareListOrder);
    if (query.afterNotificationId == null) {
      return visible.slice(0, query.limit);
    }
    const anchor = this.#rows.get(query.afterNotificationId);
    if (anchor == null) {
      return [];
    }
    return visible.filter((row) => compareListOrder(anchor, row) < 0).slice(0, query.limit);
  }

  async countUnread(userId: string, types?: readonly NotificationType[]): Promise<number> {
    return [...this.#rows.values()].filter(
      (row) => row.userId === userId && !row.isRead && isOfTypes(row, types),
    ).length;
  }
}
