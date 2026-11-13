import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import {
  and,
  countDistinct,
  eq,
  exists,
  getTableName,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  max,
  notInArray,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { compact, groupBy } from "es-toolkit";

import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import { hasNoBlockWith } from "#api/modules/social/blocks/social-block-queries.public";
import { USER_BRIEF_RELATION } from "#api/modules/social/friends/social-friends.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { tupleLessThan } from "#api/platform/database/keyset";
import {
  nudge as nudgeTable,
  reminderNudge as reminderNudgeTable,
  todo as todoTable,
} from "#api/platform/database/schema/index";
import { nextSequenceValue } from "#api/platform/database/sequence";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { DailySendWindow } from "../../../shared/domain/daily-send-window.domain-service.js";
import type {
  ListNudgesParams,
  NudgeReaderPort,
} from "../../application/ports/nudge.reader.port.js";
import type {
  NudgeRepositoryPort,
  NudgeThanksCandidateQuery,
} from "../../application/ports/nudge.repository.port.js";
import type {
  NudgeInteractionTodo,
  NudgeThanksRecipient,
} from "../../application/read-models/nudge-interaction.read-model.js";
import type { NudgeListItem } from "../../application/read-models/nudge.read-model.js";
import { NudgeId } from "../../domain/nudge-id.vo.js";
import type { NudgeTargetTodo } from "../../domain/nudge-target-todo.vo.js";
import type { Nudge } from "../../domain/nudge.aggregate.js";
import type { NudgeDirection } from "../../domain/nudges.constants.js";
import { ReminderNudgeId } from "../../domain/reminder-nudge-id.vo.js";
import type { ReminderNudge } from "../../domain/reminder-nudge.aggregate.js";
import {
  toNudge,
  toNudgeInteractionTodo,
  toNudgeListItem,
  toNudgeRow,
  toNudgeTargetTodo,
  toNudgeUserSummary,
  toReminderNudge,
  toReminderNudgeRow,
} from "./nudge-row.mapper.js";

const NUDGE_RELATIONS = {
  sender: USER_BRIEF_RELATION,
  receiver: USER_BRIEF_RELATION,
  todo: { columns: { id: true, title: true, completed: true, userId: true, visibility: true } },
} as const;

const INTERACTION_TODO_COLUMNS = {
  id: todoTable.id,
  userId: todoTable.userId,
  title: todoTable.title,
  completed: todoTable.completed,
  visibility: todoTable.visibility,
};

// 동시에 읽음·감사가 저장돼도 먼저 남은 시각을 덮어쓰지 않는다
function keepStoredInstant(column: AnyPgColumn): SQL {
  const name = sql.identifier(column.name);
  return sql`coalesce(${sql.identifier(getTableName(nudgeTable))}.${name}, excluded.${name})`;
}

@Injectable()
export class DrizzleNudgeRepository implements NudgeRepositoryPort, NudgeReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async nextId(): Promise<NudgeId> {
    return NudgeId.reconstitute(await nextSequenceValue(this.#db, nudgeTable.id));
  }

  async findById(nudgeId: NudgeId): Promise<Nudge | null> {
    const row = await this.#db.query.nudge.findFirst({ where: { id: nudgeId.value } });
    return row == null ? null : toNudge(row);
  }

  async findLastSentForTodo(senderId: UserId, todoId: TodoId): Promise<Nudge | null> {
    const row = await this.#db.query.nudge.findFirst({
      where: { senderId: senderId.value, todoId: todoId.value },
      orderBy: { createdAt: "desc" },
    });
    return row == null ? null : toNudge(row);
  }

  async findLastSentTo(senderId: UserId, receiverId: UserId): Promise<Nudge | null> {
    const row = await this.#db.query.nudge.findFirst({
      where: { senderId: senderId.value, receiverId: receiverId.value },
      orderBy: { createdAt: "desc" },
    });
    return row == null ? null : toNudge(row);
  }

  countSentBetween(
    senderId: UserId,
    window: Pick<DailySendWindow, "startsAt" | "endsAt">,
  ): Promise<number> {
    return this.#db.$count(
      nudgeTable,
      and(
        eq(nudgeTable.senderId, senderId.value),
        gte(nudgeTable.createdAt, window.startsAt),
        lt(nudgeTable.createdAt, window.endsAt),
      ),
    );
  }

  async save(nudge: Nudge): Promise<void> {
    const row = toNudgeRow(nudge);
    await this.#db
      .insert(nudgeTable)
      .values(row)
      .onConflictDoUpdate({
        target: nudgeTable.id,
        set: {
          readAt: keepStoredInstant(nudgeTable.readAt),
          replyKind: row.replyKind,
          repliedAt: row.repliedAt,
          replyUpdatedAt: row.replyUpdatedAt,
          thankedAt: keepStoredInstant(nudgeTable.thankedAt),
        },
      });
  }

  async saveThanks(nudges: readonly Nudge[]): Promise<void> {
    const byThankedAt = groupBy(
      nudges.filter((nudge) => nudge.thankedAt != null),
      (nudge) => String(nudge.thankedAt?.epochMilliseconds),
    );
    for (const group of Object.values(byThankedAt)) {
      const thankedAt = group[0]?.thankedAt;
      if (thankedAt == null) {
        continue;
      }
      await this.#db
        .update(nudgeTable)
        .set({ thankedAt })
        .where(
          and(
            inArray(
              nudgeTable.id,
              group.map((nudge) => nudge.id.value),
            ),
            isNull(nudgeTable.thankedAt),
          ),
        );
    }
  }

  async listThanksCandidates(query: NudgeThanksCandidateQuery): Promise<Nudge[]> {
    const ids = await this.#listThanksCandidateIds(query);
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.#db.query.nudge.findMany({
      where: { id: { in: ids } },
      orderBy: { id: "desc" },
    });
    return rows.map(toNudge);
  }

  async findTargetTodo(todoId: TodoId): Promise<NudgeTargetTodo | null> {
    const row = await this.#db.query.todo.findFirst({
      columns: { userId: true, title: true, visibility: true, startDate: true, endDate: true },
      where: { id: todoId.value },
    });
    return row == null ? null : toNudgeTargetTodo(row);
  }

  async lockInteractionTodo(todoId: TodoId, ownerId: UserId): Promise<NudgeInteractionTodo | null> {
    const [row] = await this.#db
      .select(INTERACTION_TODO_COLUMNS)
      .from(todoTable)
      .where(and(eq(todoTable.id, todoId.value), eq(todoTable.userId, ownerId.value)))
      .limit(1)
      .for("update");
    return row == null ? null : toNudgeInteractionTodo(row);
  }

  countTodosOn(ownerId: UserId, date: Temporal.PlainDate): Promise<number> {
    return this.#db.$count(
      todoTable,
      and(
        eq(todoTable.userId, ownerId.value),
        or(
          and(lte(todoTable.startDate, date), gte(todoTable.endDate, date)),
          and(eq(todoTable.startDate, date), isNull(todoTable.endDate)),
        ),
      ),
    );
  }

  async nextReminderId(): Promise<ReminderNudgeId> {
    return ReminderNudgeId.reconstitute(await nextSequenceValue(this.#db, reminderNudgeTable.id));
  }

  async findLastReminderSentTo(
    senderId: UserId,
    receiverId: UserId,
  ): Promise<ReminderNudge | null> {
    const row = await this.#db.query.reminderNudge.findFirst({
      where: { senderId: senderId.value, receiverId: receiverId.value },
      orderBy: { createdAt: "desc" },
    });
    return row == null ? null : toReminderNudge(row);
  }

  async saveReminder(reminder: ReminderNudge): Promise<void> {
    await this.#db.insert(reminderNudgeTable).values(toReminderNudgeRow(reminder));
  }

  listReceived(params: ListNudgesParams): Promise<NudgeListItem[]> {
    return this.#listOwned(params, "received");
  }

  listSent(params: ListNudgesParams): Promise<NudgeListItem[]> {
    return this.#listOwned(params, "sent");
  }

  countReceived(userId: UserId): Promise<number> {
    return this.#db.$count(
      nudgeTable,
      and(
        eq(nudgeTable.receiverId, userId.value),
        hasNoBlockWith(nudgeTable.senderId, userId.value),
      ),
    );
  }

  countSent(userId: UserId): Promise<number> {
    return this.#db.$count(
      nudgeTable,
      and(
        eq(nudgeTable.senderId, userId.value),
        hasNoBlockWith(nudgeTable.receiverId, userId.value),
      ),
    );
  }

  countUnreadReceived(userId: UserId): Promise<number> {
    return this.#db.$count(
      nudgeTable,
      and(
        eq(nudgeTable.receiverId, userId.value),
        isNull(nudgeTable.readAt),
        hasNoBlockWith(nudgeTable.senderId, userId.value),
      ),
    );
  }

  async findInteraction(nudgeId: NudgeId, viewerId: UserId): Promise<NudgeListItem | null> {
    const row = await this.#db.query.nudge.findFirst({
      where: {
        id: nudgeId.value,
        OR: [
          {
            receiverId: viewerId.value,
            RAW: (table) => hasNoBlockWith(table.senderId, viewerId.value),
          },
          {
            senderId: viewerId.value,
            RAW: (table) => hasNoBlockWith(table.receiverId, viewerId.value),
          },
        ],
      },
      with: NUDGE_RELATIONS,
    });
    return row == null ? null : toNudgeListItem(row);
  }

  async listInteractions(params: {
    readonly viewerId: UserId;
    readonly direction: NudgeDirection;
    readonly afterNudgeId: NudgeId | null;
    readonly limit: number;
  }): Promise<NudgeListItem[]> {
    const { viewerId, direction, afterNudgeId, limit } = params;
    const rows = await this.#db.query.nudge.findMany({
      where: {
        ...(direction === "received"
          ? { receiverId: viewerId.value }
          : { senderId: viewerId.value }),
        RAW: (table) =>
          hasNoBlockWith(
            direction === "received" ? table.senderId : table.receiverId,
            viewerId.value,
          ),
        ...(afterNudgeId != null && { id: { lt: afterNudgeId.value } }),
      },
      with: NUDGE_RELATIONS,
      orderBy: { id: "desc" },
      limit,
    });
    return rows.map(toNudgeListItem);
  }

  async findInteractionTodo(todoId: TodoId, ownerId: UserId): Promise<NudgeInteractionTodo | null> {
    const row = await this.#db.query.todo.findFirst({
      columns: { id: true, userId: true, title: true, completed: true, visibility: true },
      where: { id: todoId.value, userId: ownerId.value },
    });
    return row == null ? null : toNudgeInteractionTodo(row);
  }

  async findLastReceivedNudgeId(todoId: TodoId, receiverId: UserId): Promise<NudgeId | null> {
    const row = await this.#db.query.nudge.findFirst({
      columns: { id: true },
      where: { todoId: todoId.value, receiverId: receiverId.value },
      orderBy: { id: "desc" },
    });
    return row == null ? null : NudgeId.reconstitute(row.id);
  }

  async countThankedRecipients(todoId: TodoId, receiverId: UserId): Promise<number> {
    const [row] = await this.#db
      .select({ count: countDistinct(nudgeTable.senderId) })
      .from(nudgeTable)
      .where(this.#thankedOnTodo(todoId, receiverId));
    return row?.count ?? 0;
  }

  async findLastThankedAt(todoId: TodoId, receiverId: UserId): Promise<Temporal.Instant | null> {
    const [row] = await this.#db
      .select({ lastThankedAt: max(nudgeTable.thankedAt) })
      .from(nudgeTable)
      .where(this.#thankedOnTodo(todoId, receiverId));
    return row?.lastThankedAt ?? null;
  }

  async listThanksRecipients(
    query: NudgeThanksCandidateQuery & {
      readonly afterNudgeId: NudgeId | null;
      readonly limit: number | null;
    },
  ): Promise<NudgeThanksRecipient[]> {
    const ids = await this.#listThanksCandidateIds(query);
    const { afterNudgeId, limit } = query;
    const remainingIds = afterNudgeId == null ? ids : ids.filter((id) => id < afterNudgeId.value);
    const pageIds = limit == null ? remainingIds : remainingIds.slice(0, limit);
    if (pageIds.length === 0) {
      return [];
    }
    const rows = await this.#db.query.nudge.findMany({
      columns: { id: true },
      where: { id: { in: pageIds } },
      with: { sender: USER_BRIEF_RELATION },
      orderBy: { id: "desc" },
    });
    return rows.map((row) => ({ nudgeId: row.id, sender: toNudgeUserSummary(row.sender) }));
  }

  async countThanksRecipients(query: NudgeThanksCandidateQuery): Promise<number> {
    if (query.friendIds.length === 0) {
      return 0;
    }
    // 후보는 보낸 사람마다 하나라 id를 가져오지 않고 보낸 사람 수를 센다
    const [row] = await this.#db
      .select({ count: countDistinct(nudgeTable.senderId) })
      .from(nudgeTable)
      .where(await this.#thanksCandidateCondition(query));
    return row?.count ?? 0;
  }

  #thankedOnTodo(todoId: TodoId, receiverId: UserId): SQL | undefined {
    return and(
      eq(nudgeTable.todoId, todoId.value),
      eq(nudgeTable.receiverId, receiverId.value),
      isNotNull(nudgeTable.thankedAt),
    );
  }

  async #listThanksCandidateIds(query: NudgeThanksCandidateQuery): Promise<number[]> {
    if (query.friendIds.length === 0) {
      return [];
    }
    const groups = await this.#db
      .select({ latestId: max(nudgeTable.id) })
      .from(nudgeTable)
      .where(await this.#thanksCandidateCondition(query))
      .groupBy(nudgeTable.senderId);
    return compact(groups.map((group) => group.latestId)).toSorted((left, right) => right - left);
  }

  // 아직 고마움을 받지 않은 친구가 공개 할 일에 보낸 콕. 보낸 사람마다 묶으면 감사 후보 하나다
  async #thanksCandidateCondition(query: NudgeThanksCandidateQuery): Promise<SQL | undefined> {
    const thanked = await this.#db
      .select({ senderId: nudgeTable.senderId })
      .from(nudgeTable)
      .where(this.#thankedOnTodo(query.todoId, query.ownerId));
    const thankedSenderIds = thanked.map((row) => row.senderId);
    return and(
      eq(nudgeTable.todoId, query.todoId.value),
      eq(nudgeTable.receiverId, query.ownerId.value),
      lte(nudgeTable.id, query.throughNudgeId.value),
      inArray(
        nudgeTable.senderId,
        query.friendIds.map((friendId) => friendId.value),
      ),
      thankedSenderIds.length === 0 ? undefined : notInArray(nudgeTable.senderId, thankedSenderIds),
      isNull(nudgeTable.thankedAt),
      exists(
        this.#db
          .select({ one: sql`1` })
          .from(todoTable)
          .where(
            and(
              eq(todoTable.id, nudgeTable.todoId),
              eq(todoTable.visibility, "PUBLIC"),
              eq(todoTable.userId, query.ownerId.value),
            ),
          ),
      ),
    );
  }

  async #listOwned(params: ListNudgesParams, direction: NudgeDirection): Promise<NudgeListItem[]> {
    const { userId, afterNudgeId, limit } = params;
    // 커서는 콕 id 하나라 그 콕의 생성 시각을 먼저 읽어 (createdAt, id) 경계를 만든다
    const anchor =
      afterNudgeId == null
        ? null
        : await this.#db.query.nudge.findFirst({
            columns: { id: true, createdAt: true },
            where: { id: afterNudgeId.value },
          });
    if (afterNudgeId != null && anchor == null) {
      return [];
    }

    const rows = await this.#db.query.nudge.findMany({
      where: {
        ...(direction === "received" ? { receiverId: userId.value } : { senderId: userId.value }),
        AND: [
          {
            RAW: (table) =>
              hasNoBlockWith(
                direction === "received" ? table.senderId : table.receiverId,
                userId.value,
              ),
          },
          ...(anchor == null
            ? []
            : [
                {
                  RAW: (table: typeof nudgeTable) =>
                    tupleLessThan([table.createdAt, table.id], [anchor.createdAt, anchor.id]),
                },
              ]),
        ],
      },
      with: NUDGE_RELATIONS,
      orderBy: { createdAt: "desc", id: "desc" },
      limit,
    });
    return rows.map(toNudgeListItem);
  }
}
