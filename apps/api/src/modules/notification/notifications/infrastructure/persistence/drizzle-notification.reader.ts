import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, count, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { notification } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { NotificationId } from "../../../shared/domain/notification-id.vo.js";
import type { NotificationMilestone } from "../../../shared/domain/notification-milestone.constants.js";
import type { NotificationType } from "../../../shared/domain/notification-type.constants.js";
import type {
  ExistsRecentNotificationQuery,
  FindAlreadyNotifiedUserIdsQuery,
  FindNudgeSuggestedFriendsQuery,
  FindWinbackStagesSinceQuery,
  NotificationHistoryReaderPort,
} from "../../application/ports/notification-history.reader.port.js";
import type {
  ListInboxNotificationsQuery,
  NotificationInboxReaderPort,
} from "../../application/ports/notification-inbox.reader.port.js";
import type { InboxNotificationReadModel } from "../../application/read-models/inbox-notification.read-model.js";
import { milestoneNotificationCondition } from "./milestone-notification.query-fragment.js";

@Injectable()
export class DrizzleNotificationReader
  implements NotificationInboxReaderPort, NotificationHistoryReaderPort
{
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  async findInboxNotification(
    notificationId: NotificationId,
  ): Promise<InboxNotificationReadModel | null> {
    const [row] = await this.#db
      .select()
      .from(notification)
      .where(eq(notification.id, notificationId.value))
      .limit(1);
    return row ?? null;
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

  // 가장 이른 기준 시각 뒤의 행을 (userId, type) 인덱스로 한 번에 읽고 사용자마다 자기 기준 시각으로 거른다
  async findWinbackStagesSince(
    query: FindWinbackStagesSinceQuery,
  ): Promise<ReadonlyMap<string, ReadonlySet<string>>> {
    const sinceByUserId = new Map(
      query.recipients.map(({ userId, since }) => [userId.value, since]),
    );
    const earliest = [...sinceByUserId.values()].toSorted(Temporal.Instant.compare).at(0);
    if (earliest == null) {
      return new Map();
    }
    const rows = await this.#db
      .select({
        userId: notification.userId,
        stage: sql<string | null>`${notification.metadata} ->> 'stage'`,
        createdAt: notification.createdAt,
      })
      .from(notification)
      .where(
        and(
          inArray(notification.userId, [...sinceByUserId.keys()]),
          eq(notification.type, "WINBACK"),
          gte(notification.createdAt, earliest),
        ),
      );
    return toValuesByUserId(
      rows.flatMap(({ userId, stage, createdAt }) => {
        const since = sinceByUserId.get(userId);
        return since != null && stage != null && Temporal.Instant.compare(createdAt, since) >= 0
          ? [{ userId, value: stage }]
          : [];
      }),
    );
  }

  async findNudgeSuggestedFriends(
    query: FindNudgeSuggestedFriendsQuery,
  ): Promise<ReadonlyMap<string, ReadonlySet<string>>> {
    if (query.userIds.length === 0) {
      return new Map();
    }
    const rows = await this.#db
      .select({ userId: notification.userId, friendId: notification.friendId })
      .from(notification)
      .where(
        and(
          inArray(
            notification.userId,
            query.userIds.map((userId) => userId.value),
          ),
          eq(notification.type, "NUDGE_SUGGEST"),
          gte(notification.notificationDate, query.start),
          lt(notification.notificationDate, query.end),
        ),
      );
    return toValuesByUserId(
      rows.flatMap(({ userId, friendId }) =>
        friendId == null ? [] : [{ userId, value: friendId }],
      ),
    );
  }

  async hasMilestoneNotification(
    userId: UserId,
    milestone: NotificationMilestone,
  ): Promise<boolean> {
    // 종류를 걸어 (userId, type) 인덱스로 좁힌다
    const [row] = await this.#db
      .select({ id: notification.id })
      .from(notification)
      .where(and(eq(notification.userId, userId.value), milestoneNotificationCondition(milestone)))
      .limit(1);
    return row != null;
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}

function toValuesByUserId(
  rows: readonly { readonly userId: string; readonly value: string }[],
): ReadonlyMap<string, ReadonlySet<string>> {
  const valuesByUserId = new Map<string, Set<string>>();
  for (const { userId, value } of rows) {
    const values = valuesByUserId.get(userId) ?? new Set<string>();
    values.add(value);
    valuesByUserId.set(userId, values);
  }
  return valuesByUserId;
}
