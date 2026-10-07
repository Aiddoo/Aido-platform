import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { all, and } from "@prisma/orm-postgres/orm-client";

import { decodeRecord } from "#api/platform/database/database-records";
import { databaseDate, databaseTimestamp } from "#api/platform/database/database-values";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";

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
export class PrismaNotificationReader
  implements NotificationInboxReaderPort, NotificationHistoryReaderPort
{
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  private get client() {
    return this.txHost.tx;
  }

  async findNotificationById(id: number): Promise<NotificationRecord | null> {
    return this.client.orm.public.Notification.where((row) => row.id.eq(id))
      .first()
      .then((row) => decodeRecord("Notification", row));
  }

  async findNotificationsByUser(params: FindNotificationsParams): Promise<NotificationRecord[]> {
    const { userId, cursor, size, unreadOnly, types } = params;
    let notifications = this.client.orm.public.Notification.where((row) =>
      and(
        row.userId.eq(userId),
        unreadOnly === true ? row.isRead.eq(false) : all(),
        types !== undefined ? row._type.in([...types]) : all(),
      ),
    )
      .orderBy((row) => row.createdAt.desc())
      .orderBy((row) => row.id.desc())
      .limit(size + 1);
    if (cursor !== undefined && cursor !== null) {
      const anchor = await this.client.orm.public.Notification.where({ id: cursor })
        .select("id", "createdAt")
        .first();
      if (anchor === null) return [];
      notifications = notifications.cursor(anchor);
    }
    return decodeRecord("Notification", await notifications.all());
  }

  async countUnread(userId: string, types?: readonly NotificationType[]): Promise<number> {
    return this.client.orm.public.Notification.where((row) =>
      and(row.userId.eq(userId), row.isRead.eq(false), types ? row._type.in([...types]) : all()),
    )
      .aggregate((aggregate) => ({ count: aggregate.count() }))
      .then(({ count }) => count);
  }

  async existsRecentNotification(query: ExistsRecentNotificationQuery): Promise<boolean> {
    const row = await this.client.orm.public.Notification.where((row) =>
      and(
        row.userId.eq(query.userId),
        row._type.eq(query.type),
        row.createdAt.gte(databaseTimestamp(query.since)),
        query.friendId !== undefined ? row.friendId.eq(query.friendId) : all(),
        query.todoId !== undefined ? row.todoId.eq(query.todoId) : all(),
        query.nudgeId !== undefined ? row.nudgeId.eq(query.nudgeId) : all(),
        query.cheerId !== undefined ? row.cheerId.eq(query.cheerId) : all(),
      ),
    )
      .select("id")
      .first();
    return row !== null;
  }

  async findAlreadyNotifiedUserIds(query: FindAlreadyNotifiedUserIdsQuery): Promise<Set<string>> {
    const rows = await this.client.orm.public.Notification.where((row) =>
      and(
        row.userId.in(query.userIds),
        row._type.eq(query.type),
        row.notificationDate.eq(databaseDate(query.notificationDate)),
        query.friendId !== undefined ? row.friendId.eq(query.friendId) : all(),
      ),
    )
      .groupBy("userId")
      .aggregate((aggregate) => ({ count: aggregate.count() }));
    return new Set(rows.map((row) => row.userId));
  }

  async hasMilestoneNotification(
    userId: string,
    milestone: NotificationMilestone,
  ): Promise<boolean> {
    const row = await this.client.orm.public.Notification.where({ userId })
      .where((notification) =>
        this.client.raw.sql`${notification.metadata} ->> 'milestone' = ${milestone}`
          .returns("pg/bool@1")
          .buildAst(),
      )
      .select("id")
      .first();
    return row !== null;
  }
}
