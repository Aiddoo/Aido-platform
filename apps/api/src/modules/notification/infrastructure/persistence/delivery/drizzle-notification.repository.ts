import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { uniq } from "es-toolkit";

import {
  isUniqueConstraintViolation,
  requireRecord,
} from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { notification, pushDispatch } from "#api/platform/database/schema/index";
import { now } from "#api/shared/domain/date/utils/core";

import type { CreateNotificationData } from "../../../application/ports/delivery/notification-data.js";
import {
  DuplicateNotificationError,
  type NotificationRepositoryPort,
} from "../../../application/ports/delivery/notification.repository.port.js";
import type { NotificationRecord } from "../../../application/read-models/delivery/notification.read-model.js";
import type { NotificationType } from "../../../domain/types/delivery/notification-type.js";

type NotificationInsert = typeof notification.$inferInsert;

function toNotificationInsert(data: CreateNotificationData): NotificationInsert {
  return {
    userId: data.userId,
    type: data.type,
    title: data.title,
    body: data.body,
    todoId: data.todoId,
    friendId: data.friendId,
    nudgeId: data.nudgeId,
    cheerId: data.cheerId,
    metadata: data.metadata ?? undefined,
    notificationDate: data.notificationDate ?? undefined,
    actionType: data.action?.type ?? "DEEP_LINK",
    actionUrl: data.action?.url,
    campaignKey: data.campaignKey,
    variantId: data.variantId,
    purpose: data.purpose ?? "TRANSACTIONAL",
    reminderOccurrenceKey: data.reminderOccurrenceKey,
  };
}

@Injectable()
export class DrizzleNotificationRepository implements NotificationRepositoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  async createNotification(data: CreateNotificationData): Promise<NotificationRecord> {
    try {
      const [row] = await this.db
        .insert(notification)
        .values(toNotificationInsert(data))
        .returning();
      return requireRecord(row);
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
    if (dataList.length === 0) {
      return [];
    }

    try {
      return await this.db
        .insert(notification)
        .values(dataList.map(toNotificationInsert))
        .onConflictDoNothing()
        .returning();
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new DuplicateNotificationError();
      }
      throw error;
    }
  }

  async markAsRead(id: number, userId: string): Promise<boolean> {
    const updated = await this.db
      .update(notification)
      .set({ isRead: true, readAt: now() })
      .where(
        and(
          eq(notification.id, id),
          eq(notification.userId, userId),
          eq(notification.isRead, false),
        ),
      )
      .returning({ id: notification.id });
    return updated.length > 0;
  }

  async markAsOpened(id: number, userId: string): Promise<boolean> {
    const openedAt = now();
    const updated = await this.db
      .update(notification)
      .set({ openedAt, isRead: true, readAt: openedAt })
      .where(
        and(
          eq(notification.id, id),
          eq(notification.userId, userId),
          isNull(notification.openedAt),
        ),
      )
      .returning({ id: notification.id });
    if (updated.length > 0) {
      await this.db
        .update(pushDispatch)
        .set({ openedAt })
        .where(
          and(
            eq(pushDispatch.notificationId, id),
            eq(pushDispatch.userId, userId),
            isNull(pushDispatch.openedAt),
          ),
        );
    }
    return updated.length > 0;
  }

  async markAllAsRead(
    userId: string,
    types?: readonly NotificationType[],
  ): Promise<{ count: number }> {
    const updated = await this.db
      .update(notification)
      .set({ isRead: true, readAt: now() })
      .where(
        and(
          eq(notification.userId, userId),
          eq(notification.isRead, false),
          types ? inArray(notification.type, [...types]) : undefined,
        ),
      )
      .returning({ id: notification.id });
    return { count: updated.length };
  }

  async deleteNotificationsByActorId(
    actorId: string,
  ): Promise<{ count: number; affectedUserIds: string[] }> {
    const deletedRows = await this.db
      .delete(notification)
      .where(
        or(
          eq(notification.friendId, actorId),
          sql`${notification.metadata} ->> 'senderId' = ${actorId}`,
        ),
      )
      .returning({ userId: notification.userId });

    return {
      count: deletedRows.length,
      affectedUserIds: uniq(deletedRows.map((row) => row.userId)),
    };
  }
}
