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
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { CreateNotificationData } from "../../application/ports/notification-draft.port.js";
import {
  DuplicateNotificationError,
  type NotificationRepositoryPort,
} from "../../application/ports/notification.repository.port.js";
import type { InboxNotification } from "../../application/read-models/inbox-notification.read-model.js";
import type { NotificationId } from "../../domain/notification-id.vo.js";
import type { NotificationType } from "../../domain/notification-type.constants.js";
import type { Notification } from "../../domain/notification.aggregate.js";
import { toNotification } from "./notification-row.mapper.js";

type NotificationInsert = typeof notification.$inferInsert;

function toNotificationInsert(data: CreateNotificationData): NotificationInsert {
  return {
    userId: data.userId,
    type: data.type,
    title: data.title,
    body: data.body,
    copyKey: data.copyKey,
    copyFacts: data.copyFacts,
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
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async findById(notificationId: NotificationId): Promise<Notification | null> {
    const row = await this.#db.query.notification.findFirst({
      where: { id: notificationId.value },
    });
    return row == null ? null : toNotification(row);
  }

  async createNotification(data: CreateNotificationData): Promise<InboxNotification> {
    try {
      const [row] = await this.#db
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
  ): Promise<InboxNotification[]> {
    if (dataList.length === 0) {
      return [];
    }

    try {
      return await this.#db
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

  async markAsRead(target: Notification): Promise<boolean> {
    const { id, userId, isRead, readAt } = target.toPrimitives();
    const updated = await this.#db
      .update(notification)
      .set({ isRead, readAt })
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

  async markAsOpened(
    notificationId: NotificationId,
    owner: UserId,
    now: Temporal.Instant,
  ): Promise<boolean> {
    const id = notificationId.value;
    const userId = owner.value;
    const updated = await this.#db
      .update(notification)
      .set({ openedAt: now, isRead: true, readAt: now })
      .where(
        and(
          eq(notification.id, id),
          eq(notification.userId, userId),
          isNull(notification.openedAt),
        ),
      )
      .returning({ id: notification.id });
    if (updated.length > 0) {
      await this.#db
        .update(pushDispatch)
        .set({ openedAt: now, updatedAt: now })
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
    userId: UserId,
    types: readonly NotificationType[] | undefined,
    now: Temporal.Instant,
  ): Promise<{ count: number }> {
    const updated = await this.#db
      .update(notification)
      .set({ isRead: true, readAt: now })
      .where(
        and(
          eq(notification.userId, userId.value),
          eq(notification.isRead, false),
          types ? inArray(notification.type, [...types]) : undefined,
        ),
      )
      .returning({ id: notification.id });
    return { count: updated.length };
  }

  async deleteNotificationsByActorId(
    actor: UserId,
  ): Promise<{ count: number; affectedUserIds: string[] }> {
    const actorId = actor.value;
    const deletedRows = await this.#db
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
