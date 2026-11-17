import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, count, desc, eq, inArray, lt, or, sql } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { notification } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { NotificationMilestone } from "../../../shared/domain/notification-milestone.constants.js";
import type { NotificationType } from "../../../shared/domain/notification-type.constants.js";
import type {
  ExistsRecentNotificationQuery,
  FindAlreadyNotifiedUserIdsQuery,
  NotificationHistoryReaderPort,
} from "../../application/ports/notification-history.reader.port.js";
import type {
  ListInboxNotificationsQuery,
  NotificationInboxReaderPort,
} from "../../application/ports/notification-inbox.reader.port.js";
import type { InboxNotificationReadModel } from "../../application/read-models/inbox-notification.read-model.js";

@Injectable()
export class DrizzleNotificationReader
  implements NotificationInboxReaderPort, NotificationHistoryReaderPort
{
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  get #db() {
    return this.#transactionHost.tx;
  }

  async listByUser(query: ListInboxNotificationsQuery): Promise<InboxNotificationReadModel[]> {
    const { userId, afterNotificationId, limit, unreadOnly, types } = query;
    const anchor =
      afterNotificationId == null
        ? undefined
        : await this.#db.query.notification.findFirst({
            columns: { id: true, createdAt: true },
            where: { id: afterNotificationId.value },
          });
    if (afterNotificationId != null && anchor == null) {
      return [];
    }

    return this.#db
      .select()
      .from(notification)
      .where(
        and(
          eq(notification.userId, userId.value),
          unreadOnly ? eq(notification.isRead, false) : undefined,
          types != null ? inArray(notification.type, [...types]) : undefined,
          anchor &&
            or(
              lt(notification.createdAt, anchor.createdAt),
              and(eq(notification.createdAt, anchor.createdAt), lt(notification.id, anchor.id)),
            ),
        ),
      )
      .orderBy(desc(notification.createdAt), desc(notification.id))
      .limit(limit);
  }

  countUnread(userId: UserId, types?: readonly NotificationType[]): Promise<number> {
    return this.#db.$count(
      notification,
      and(
        eq(notification.userId, userId.value),
        eq(notification.isRead, false),
        types ? inArray(notification.type, [...types]) : undefined,
      ),
    );
  }

  async existsRecentNotification(query: ExistsRecentNotificationQuery): Promise<boolean> {
    const row = await this.#db.query.notification.findFirst({
      columns: { id: true },
      where: {
        userId: query.userId.value,
        type: query.type,
        createdAt: { gte: query.since },
        ...(query.friendId != null && { friendId: query.friendId.value }),
        ...(query.todoId != null && { todoId: query.todoId.value }),
        ...(query.nudgeId != null && { nudgeId: query.nudgeId }),
        ...(query.cheerId != null && { cheerId: query.cheerId }),
      },
    });
    return row != null;
  }

  async findAlreadyNotifiedUserIds(query: FindAlreadyNotifiedUserIdsQuery): Promise<Set<string>> {
    const rows = await this.#db
      .select({ userId: notification.userId, count: count() })
      .from(notification)
      .where(
        and(
          inArray(
            notification.userId,
            query.userIds.map((userId) => userId.value),
          ),
          eq(notification.type, query.type),
          eq(notification.notificationDate, query.notificationDate),
          query.friendId != null ? eq(notification.friendId, query.friendId.value) : undefined,
        ),
      )
      .groupBy(notification.userId);
    return new Set(rows.map((row) => row.userId));
  }

  async hasMilestoneNotification(
    userId: UserId,
    milestone: NotificationMilestone,
  ): Promise<boolean> {
    // 마일스톤은 처음부터 WEEKLY_ACHIEVEMENT로만 보냈다. 종류를 걸어 (userId, type) 인덱스로 좁힌다
    const row = await this.#db.query.notification.findFirst({
      columns: { id: true },
      where: {
        userId: userId.value,
        type: "WEEKLY_ACHIEVEMENT",
        RAW: (table) => sql`${table.metadata} ->> 'milestone' = ${milestone}`,
      },
    });
    return row != null;
  }
}
