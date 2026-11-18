import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, gte, inArray, isNull, lt, not, or, sql } from "drizzle-orm";
import { uniq } from "es-toolkit";

import {
  isUniqueConstraintViolation,
  requireRecord,
} from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { notification, pushDispatch } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { CreateNotificationData } from "../../../shared/domain/notification-draft.constants.js";
import type { NotificationId } from "../../../shared/domain/notification-id.vo.js";
import type { NotificationType } from "../../../shared/domain/notification-type.constants.js";
import { duplicateNotification } from "../../application/notifications.errors.js";
import type {
  DeletedNotificationHistory,
  NotificationRepositoryPort,
} from "../../application/ports/notification.repository.port.js";
import type { InboxNotificationReadModel } from "../../application/read-models/inbox-notification.read-model.js";
import type { Notification } from "../../domain/notification.aggregate.js";
import { milestoneNotificationCondition } from "./milestone-notification.query-fragment.js";
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
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  async findById(notificationId: NotificationId): Promise<Notification | null> {
    const row = await this.#db.query.notification.findFirst({
      where: { id: notificationId.value },
    });
    return row == null ? null : toNotification(row);
  }

  async createNotification(data: CreateNotificationData): Promise<InboxNotificationReadModel> {
    try {
      const [row] = await this.#db
        .insert(notification)
        .values(toNotificationInsert(data))
        .returning();
      return requireRecord(row);
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw duplicateNotification();
      }
      throw error;
    }
  }

  async createManyNotificationsAndReturn(
    dataList: CreateNotificationData[],
  ): Promise<InboxNotificationReadModel[]> {
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
        throw duplicateNotification();
      }
      throw error;
    }
  }

  async save(target: Notification): Promise<boolean> {
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
  ): Promise<{ count: number; affectedUserIds: UserId[] }> {
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
      affectedUserIds: uniq(deletedRows.map((row) => row.userId)).map((userId) =>
        UserId.reconstitute(userId),
      ),
    };
  }

  async deleteCreatedBefore(query: {
    readonly createdBefore: Temporal.Instant;
    readonly createdFrom: Temporal.Instant | null;
    readonly limit: number;
  }): Promise<DeletedNotificationHistory> {
    const candidates = this.#db
      .select({ id: notification.id })
      .from(notification)
      .where(
        and(
          lt(notification.createdAt, query.createdBefore),
          query.createdFrom == null ? undefined : gte(notification.createdAt, query.createdFrom),
          not(milestoneNotificationCondition(null)),
        ),
      )
      .orderBy(asc(notification.createdAt), asc(notification.id))
      .limit(query.limit);
    const deleted = await this.#db
      .delete(notification)
      .where(inArray(notification.id, candidates))
      .returning({
        createdAt: notification.createdAt,
        userId: notification.userId,
        isRead: notification.isRead,
      });
    const lastCreatedAt = deleted
      .map(({ createdAt }) => createdAt)
      .toSorted(Temporal.Instant.compare)
      .at(-1);
    const unreadOwnerIds = uniq(
      deleted.filter(({ isRead }) => !isRead).map(({ userId }) => userId),
    ).map((userId) => UserId.reconstitute(userId));
    return { deletedCount: deleted.length, lastCreatedAt: lastCreatedAt ?? null, unreadOwnerIds };
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
