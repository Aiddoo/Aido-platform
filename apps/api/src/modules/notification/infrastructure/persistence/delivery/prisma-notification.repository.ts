import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { all, and } from "@prisma/orm-postgres/orm-client";
import sql from "sql-template-tag";

import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { decodeSqlRows, sqlRowSpec, sqlStatement } from "#api/platform/database/database-sql";
import { toInputJson } from "#api/platform/database/json.util";
import { isUniqueConstraintViolation } from "#api/platform/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import { now } from "#api/shared/domain/date/utils/core";

import type { CreateNotificationData } from "../../../application/ports/delivery/notification-data.js";
import {
  DuplicateNotificationError,
  type NotificationRepositoryPort,
} from "../../../application/ports/delivery/notification.repository.port.js";
import type { NotificationRecord } from "../../../domain/records/delivery/notification.record.js";
import type { NotificationType } from "../../../domain/types/delivery/notification-type.js";

@Injectable()
export class PrismaNotificationRepository implements NotificationRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  private get client() {
    return this.txHost.tx;
  }

  async createNotification(data: CreateNotificationData): Promise<NotificationRecord> {
    try {
      return decodeRecord(
        "Notification",
        await this.client.orm.public.Notification.create(
          encodeCreate("Notification", {
            userId: data.userId,
            type: data.type,
            title: data.title,
            body: data.body,
            todoId: data.todoId,
            friendId: data.friendId,
            nudgeId: data.nudgeId,
            cheerId: data.cheerId,
            metadata: data.metadata != null ? toInputJson(data.metadata) : undefined,
            notificationDate: data.notificationDate ?? undefined,
            actionType: data.action?.type ?? "DEEP_LINK",
            actionUrl: data.action?.url,
            campaignKey: data.campaignKey,
            variantId: data.variantId,
            purpose: data.purpose ?? "TRANSACTIONAL",
          }),
        ),
      );
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new DuplicateNotificationError();
      }
      throw error;
    }
  }

  async createManyNotificationsAndReturn(
    dataList: CreateNotificationData[],
  ): Promise<NotificationRecord[]> {
    if (dataList.length === 0) return [];

    try {
      return decodeRecord(
        "Notification",
        await this.client.orm.public.Notification.createAll(
          dataList
            .map((data) => ({
              userId: data.userId,
              type: data.type,
              title: data.title,
              body: data.body,
              todoId: data.todoId,
              friendId: data.friendId,
              nudgeId: data.nudgeId,
              cheerId: data.cheerId,
              metadata: data.metadata != null ? toInputJson(data.metadata) : undefined,
              notificationDate: data.notificationDate ?? undefined,
              actionType: data.action?.type ?? "DEEP_LINK",
              actionUrl: data.action?.url,
              campaignKey: data.campaignKey,
              variantId: data.variantId,
              purpose: data.purpose ?? "TRANSACTIONAL",
            }))
            .map((value) => encodeCreate("Notification", value)),
          { onConflict: "skip" },
        ),
      );
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new DuplicateNotificationError();
      }
      throw error;
    }
  }

  async markAsRead(id: number, userId: string): Promise<boolean> {
    const result = {
      count: await this.client.orm.public.Notification.where((row) =>
        and(row.id.eq(id), row.userId.eq(userId), row.isRead.eq(false)),
      ).updateAndCount(encodePatch("Notification", { isRead: true, readAt: now() })),
    };
    return result.count > 0;
  }

  async markAsOpened(id: number, userId: string): Promise<boolean> {
    const openedAt = now();
    const result = {
      count: await this.client.orm.public.Notification.where((row) =>
        and(row.id.eq(id), row.userId.eq(userId), row.openedAt.isNull()),
      ).updateAndCount(encodePatch("Notification", { openedAt, isRead: true, readAt: openedAt })),
    };
    if (result.count > 0) {
      await this.client.orm.public.PushDispatch.where((row) =>
        and(row.notificationId.eq(id), row.userId.eq(userId), row.openedAt.isNull()),
      ).updateAndCount(encodePatch("PushDispatch", { openedAt }));
    }
    return result.count > 0;
  }

  async markAllAsRead(
    userId: string,
    types?: readonly NotificationType[],
  ): Promise<{ count: number }> {
    return this.client.orm.public.Notification.where((row) =>
      and(row.userId.eq(userId), row.isRead.eq(false), types ? row._type.in([...types]) : all()),
    )
      .updateAndCount(encodePatch("Notification", { isRead: true, readAt: now() }))
      .then((count) => ({ count }));
  }

  async deleteNotificationsByActorId(
    actorId: string,
  ): Promise<{ count: number; affectedUserIds: string[] }> {
    const sqlRows1 = sqlRowSpec({ userId: "pg/text@1" });

    const deletedRows = decodeSqlRows(
      sqlRows1,
      await this.client.query(
        sqlStatement(
          this.client,
          sql`
			DELETE FROM "Notification"
			WHERE "friendId" = ${actorId}
				OR "metadata" ->> 'senderId' = ${actorId}
			RETURNING "userId"
		`,
        )
          .returnsRow(sqlRows1)
          .build(),
      ),
    );

    return {
      count: deletedRows.length,
      affectedUserIds: [...new Set(deletedRows.map((row) => row.userId))],
    };
  }
}
