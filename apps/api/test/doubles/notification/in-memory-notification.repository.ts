import { isPlainObject, uniq } from "es-toolkit";

import { duplicateNotification } from "#api/modules/notification/notifications/application/notifications.errors";
import type {
  ExistsRecentNotificationQuery,
  FindAlreadyNotifiedUserIdsQuery,
  NotificationHistoryReaderPort,
} from "#api/modules/notification/notifications/application/ports/notification-history.reader.port";
import type {
  ListInboxNotificationsQuery,
  NotificationInboxReaderPort,
} from "#api/modules/notification/notifications/application/ports/notification-inbox.reader.port";
import { NotificationRepositoryPort } from "#api/modules/notification/notifications/application/ports/notification.repository.port";
import type { InboxNotificationReadModel } from "#api/modules/notification/notifications/application/read-models/inbox-notification.read-model";
import type { NotificationId } from "#api/modules/notification/notifications/domain/notification-id.vo";
import { Notification } from "#api/modules/notification/notifications/domain/notification.aggregate";
import type { CreateNotificationData } from "#api/modules/notification/shared/domain/notification-draft.constants";
import type { NotificationMilestone } from "#api/modules/notification/shared/domain/notification-milestone.constants";
import type { NotificationType } from "#api/modules/notification/shared/domain/notification-type.constants";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate } from "#api/shared/domain/time/instant";

// Drizzle 저장소와 같은 순서(createdAt·id 내림차순)로 나열한다
function compareListOrder(
  left: InboxNotificationReadModel,
  right: InboxNotificationReadModel,
): number {
  return Temporal.Instant.compare(right.createdAt, left.createdAt) || right.id - left.id;
}

function isOfTypes(
  row: InboxNotificationReadModel,
  types: readonly NotificationType[] | undefined,
) {
  return types == null || types.includes(row.type);
}

function metadataField(row: InboxNotificationReadModel, key: string): unknown {
  return isPlainObject(row.metadata) ? row.metadata[key] : undefined;
}

// Notification_todo_reminder_occurrence_dedup 유니크 인덱스와 같은 키다
function reminderOccurrenceKeyOf(
  row: InboxNotificationReadModel,
  occurrenceKey: string | null | undefined,
): string | null {
  if (row.type !== "TODO_REMINDER" || row.todoId == null) {
    return null;
  }
  return JSON.stringify([row.todoId, metadataField(row, "stage") ?? null, occurrenceKey ?? ""]);
}

// 알림함 행과 같은 모양으로 저장해 쓰기 뒤 목록·미읽음 수·이력을 그대로 읽어 볼 수 있게 한다
export class InMemoryNotificationRepository
  extends NotificationRepositoryPort
  implements NotificationInboxReaderPort, NotificationHistoryReaderPort
{
  readonly #rows = new Map<number, InboxNotificationReadModel>();
  readonly #reminderOccurrenceKeys = new Set<string>();
  readonly #now: () => Date;
  #sequence: number;

  constructor(
    rows: readonly InboxNotificationReadModel[] = [],
    now: () => Date = () => new Date(),
  ) {
    super();
    for (const row of rows) {
      this.#rows.set(row.id, row);
    }
    this.#sequence = Math.max(0, ...this.#rows.keys());
    this.#now = now;
  }

  get size(): number {
    return this.#rows.size;
  }

  rowOf(id: number): InboxNotificationReadModel | undefined {
    return this.#rows.get(id);
  }

  rows(): InboxNotificationReadModel[] {
    return [...this.#rows.values()].toSorted((left, right) => left.id - right.id);
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
      readAt: row.readAt,
      openedAt: row.openedAt,
      createdAt: row.createdAt,
    });
  }

  async createNotification(data: CreateNotificationData): Promise<InboxNotificationReadModel> {
    const created = this.#insert(data);
    if (created == null) {
      throw duplicateNotification();
    }
    return created;
  }

  async createManyNotificationsAndReturn(
    dataList: CreateNotificationData[],
  ): Promise<InboxNotificationReadModel[]> {
    const created: InboxNotificationReadModel[] = [];
    for (const data of dataList) {
      const row = this.#insert(data);
      if (row != null) {
        created.push(row);
      }
    }
    return created;
  }

  async markAsRead(notification: Notification): Promise<boolean> {
    const { id, userId, isRead, readAt } = notification.toPrimitives();
    const row = this.#rows.get(id);
    if (row == null || row.userId !== userId || row.isRead) {
      return false;
    }
    this.#rows.set(id, { ...row, isRead, readAt });
    return true;
  }

  async markAsOpened(
    notificationId: NotificationId,
    user: UserId,
    now: Temporal.Instant,
  ): Promise<boolean> {
    const userId = user.value;
    const row = this.#rows.get(notificationId.value);
    if (row == null || row.userId !== userId || row.openedAt != null) {
      return false;
    }
    this.#rows.set(row.id, { ...row, openedAt: now, isRead: true, readAt: now });
    return true;
  }

  async markAllAsRead(
    user: UserId,
    types: readonly NotificationType[] | undefined,
    now: Temporal.Instant,
  ): Promise<{ count: number }> {
    const userId = user.value;
    const targets = [...this.#rows.values()].filter(
      (row) => row.userId === userId && !row.isRead && isOfTypes(row, types),
    );
    for (const row of targets) {
      this.#rows.set(row.id, { ...row, isRead: true, readAt: now });
    }
    return { count: targets.length };
  }

  async deleteNotificationsByActorId(
    actor: UserId,
  ): Promise<{ count: number; affectedUserIds: string[] }> {
    const actorId = actor.value;
    const deleted = [...this.#rows.values()].filter(
      (row) => row.friendId === actorId || metadataField(row, "senderId") === actorId,
    );
    for (const row of deleted) {
      this.#rows.delete(row.id);
    }
    return { count: deleted.length, affectedUserIds: uniq(deleted.map((row) => row.userId)) };
  }

  async listByUser(query: ListInboxNotificationsQuery): Promise<InboxNotificationReadModel[]> {
    const visible = [...this.#rows.values()]
      .filter(
        (row) =>
          row.userId === query.userId.value &&
          (!query.unreadOnly || !row.isRead) &&
          isOfTypes(row, query.types),
      )
      .toSorted(compareListOrder);
    if (query.afterNotificationId == null) {
      return visible.slice(0, query.limit);
    }
    const anchor = this.#rows.get(query.afterNotificationId.value);
    if (anchor == null) {
      return [];
    }
    return visible.filter((row) => compareListOrder(anchor, row) < 0).slice(0, query.limit);
  }

  async countUnread(user: UserId, types?: readonly NotificationType[]): Promise<number> {
    const userId = user.value;
    return [...this.#rows.values()].filter(
      (row) => row.userId === userId && !row.isRead && isOfTypes(row, types),
    ).length;
  }

  async existsRecentNotification(query: ExistsRecentNotificationQuery): Promise<boolean> {
    return [...this.#rows.values()].some(
      (row) =>
        row.userId === query.userId.value &&
        row.type === query.type &&
        Temporal.Instant.compare(row.createdAt, query.since) >= 0 &&
        (query.friendId == null || row.friendId === query.friendId.value) &&
        (query.todoId == null || row.todoId === query.todoId.value) &&
        (query.nudgeId == null || row.nudgeId === query.nudgeId) &&
        (query.cheerId == null || row.cheerId === query.cheerId),
    );
  }

  async findAlreadyNotifiedUserIds(query: FindAlreadyNotifiedUserIdsQuery): Promise<Set<string>> {
    const { notificationDate } = query;
    return new Set(
      [...this.#rows.values()]
        .filter(
          (row) =>
            query.userIds.some((userId) => userId.value === row.userId) &&
            row.type === query.type &&
            row.notificationDate != null &&
            row.notificationDate.equals(notificationDate) &&
            (query.friendId == null || row.friendId === query.friendId.value),
        )
        .map((row) => row.userId),
    );
  }

  async hasMilestoneNotification(
    userId: UserId,
    milestone: NotificationMilestone,
  ): Promise<boolean> {
    return [...this.#rows.values()].some(
      (row) =>
        row.userId === userId.value &&
        row.type === "WEEKLY_ACHIEVEMENT" &&
        metadataField(row, "milestone") === milestone,
    );
  }

  // 유니크 인덱스에 걸리면 저장하지 않고 null을 준다
  #insert(data: CreateNotificationData): InboxNotificationReadModel | null {
    const row: InboxNotificationReadModel = {
      id: this.#sequence + 1,
      userId: data.userId,
      type: data.type,
      title: data.title,
      body: data.body,
      copyKey: data.copyKey ?? null,
      copyFacts: data.copyFacts ?? null,
      isRead: false,
      todoId: data.todoId ?? null,
      friendId: data.friendId ?? null,
      nudgeId: data.nudgeId ?? null,
      cheerId: data.cheerId ?? null,
      notificationDate: data.notificationDate ?? null,
      metadata: data.metadata ?? null,
      createdAt: instantFromDate(this.#now()),
      readAt: null,
      actionType: data.action?.type ?? "DEEP_LINK",
      actionUrl: data.action?.url ?? null,
      campaignKey: data.campaignKey ?? null,
      variantId: data.variantId ?? null,
      purpose: data.purpose ?? "TRANSACTIONAL",
      openedAt: null,
    };
    const occurrenceKey = reminderOccurrenceKeyOf(row, data.reminderOccurrenceKey);
    if (occurrenceKey != null) {
      if (this.#reminderOccurrenceKeys.has(occurrenceKey)) {
        return null;
      }
      this.#reminderOccurrenceKeys.add(occurrenceKey);
    }
    this.#sequence = row.id;
    this.#rows.set(row.id, row);
    return row;
  }
}
