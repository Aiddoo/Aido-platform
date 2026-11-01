import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, count, desc, eq, inArray, lt, or, sql } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { notification } from "#api/platform/database/schema/index";

import type { FindNotificationsParams } from "../../../application/ports/delivery/notification-data.js";
import type {
  ExistsRecentNotificationQuery,
  FindAlreadyNotifiedUserIdsQuery,
  NotificationHistoryReaderPort,
} from "../../../application/ports/delivery/notification-history.reader.port.js";
import type { NotificationInboxReaderPort } from "../../../application/ports/delivery/notification-inbox.reader.port.js";
import type { NotificationRecord } from "../../../application/read-models/delivery/notification.read-model.js";
import type { NotificationMilestone } from "../../../domain/types/delivery/notification-milestone.js";
import type { NotificationType } from "../../../domain/types/delivery/notification-type.js";

@Injectable()
export class DrizzleNotificationReader
  implements NotificationInboxReaderPort, NotificationHistoryReaderPort
{
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  async findNotificationById(id: number): Promise<NotificationRecord | null> {
    const row = await this.db.query.notification.findFirst({ where: { id } });
    return row ?? null;
  }

  async findNotificationsByUser(params: FindNotificationsParams): Promise<NotificationRecord[]> {
    const { userId, cursor, size, unreadOnly, types } = params;
    const anchor =
      cursor == null
        ? undefined
        : await this.db.query.notification.findFirst({
            columns: { id: true, createdAt: true },
            where: { id: cursor },
          });
    if (cursor != null && anchor == null) {
      return [];
    }

    return this.db
      .select()
      .from(notification)
      .where(
        and(
          eq(notification.userId, userId),
          unreadOnly === true ? eq(notification.isRead, false) : undefined,
          types != null ? inArray(notification.type, [...types]) : undefined,
          anchor &&
            or(
              lt(notification.createdAt, anchor.createdAt),
              and(eq(notification.createdAt, anchor.createdAt), lt(notification.id, anchor.id)),
            ),
        ),
      )
      .orderBy(desc(notification.createdAt), desc(notification.id))
      .limit(size + 1);
  }

  countUnread(userId: string, types?: readonly NotificationType[]): Promise<number> {
    return this.db.$count(
      notification,
      and(
        eq(notification.userId, userId),
        eq(notification.isRead, false),
        types ? inArray(notification.type, [...types]) : undefined,
      ),
    );
  }

  async existsRecentNotification(query: ExistsRecentNotificationQuery): Promise<boolean> {
    const row = await this.db.query.notification.findFirst({
      columns: { id: true },
      where: {
        userId: query.userId,
        type: query.type,
        createdAt: { gte: query.since },
        ...(query.friendId != null && { friendId: query.friendId }),
        ...(query.todoId != null && { todoId: query.todoId }),
        ...(query.nudgeId != null && { nudgeId: query.nudgeId }),
        ...(query.cheerId != null && { cheerId: query.cheerId }),
      },
    });
    return row != null;
  }

  async findAlreadyNotifiedUserIds(query: FindAlreadyNotifiedUserIdsQuery): Promise<Set<string>> {
    const rows = await this.db
      .select({ userId: notification.userId, count: count() })
      .from(notification)
      .where(
        and(
          inArray(notification.userId, query.userIds),
          eq(notification.type, query.type),
          eq(notification.notificationDate, query.notificationDate),
          query.friendId != null ? eq(notification.friendId, query.friendId) : undefined,
        ),
      )
      .groupBy(notification.userId);
    return new Set(rows.map((row) => row.userId));
  }

  async hasMilestoneNotification(
    userId: string,
    milestone: NotificationMilestone,
  ): Promise<boolean> {
    const row = await this.db.query.notification.findFirst({
      columns: { id: true },
      where: {
        userId,
        RAW: (table) => sql`${table.metadata} ->> 'milestone' = ${milestone}`,
      },
    });
    return row != null;
  }
}
