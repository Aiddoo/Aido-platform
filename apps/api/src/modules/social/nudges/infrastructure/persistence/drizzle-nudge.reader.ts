import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import {
  and,
  countDistinct,
  eq,
  exists,
  inArray,
  isNotNull,
  isNull,
  lte,
  max,
  notInArray,
  type SQL,
  sql,
} from "drizzle-orm";
import { compact } from "es-toolkit";

import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import { hasNoBlockWith } from "#api/modules/social/blocks/social-block-queries.public";
import {
  USER_BRIEF_RELATION,
  type UserBriefRow,
} from "#api/modules/social/friends/social-friends.public";
import type { Database, DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { tupleLessThan } from "#api/platform/database/keyset";
import { nudge as nudgeTable, todo as todoTable } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  ListNudgesParams,
  NudgeReaderPort,
} from "../../application/ports/nudge.reader.port.js";
import type { NudgeThanksCandidateQuery } from "../../application/ports/nudge.repository.port.js";
import type {
  NudgeInteractionTodoReadModel,
  NudgeThanksRecipientReadModel,
} from "../../application/read-models/nudge-interaction.read-model.js";
import type {
  NudgeReadModel,
  NudgeUserReadModel,
} from "../../application/read-models/nudge.read-model.js";
import { NudgeId } from "../../domain/nudge-id.vo.js";
import type { NudgeDirection } from "../../domain/nudges.constants.js";

type NudgeRow = typeof nudgeTable.$inferSelect;
type TodoRow = typeof todoTable.$inferSelect;
type InteractionTodoRow = Pick<TodoRow, "id" | "userId" | "title" | "completed" | "visibility">;
type NudgeRowWithRelations = NudgeRow & {
  readonly sender: UserBriefRow;
  readonly receiver: UserBriefRow;
  readonly todo: InteractionTodoRow;
};
type NudgeQueryExecutor = Pick<Database, "select">;

const NUDGE_RELATIONS = {
  sender: USER_BRIEF_RELATION,
  receiver: USER_BRIEF_RELATION,
  todo: { columns: { id: true, title: true, completed: true, userId: true, visibility: true } },
} as const;

export function toNudgeInteractionTodoReadModel(
  row: InteractionTodoRow,
): NudgeInteractionTodoReadModel {
  return {
    id: row.id,
    ownerId: row.userId,
    title: row.title,
    completed: row.completed,
    visibility: row.visibility,
  };
}

function toNudgeUserReadModel(row: UserBriefRow): NudgeUserReadModel {
  return {
    id: row.id,
    userTag: row.userTag,
    name: row.profile?.name ?? null,
    profileImage: row.profile?.profileImage ?? null,
  };
}

function toNudgeReadModel(row: NudgeRowWithRelations): NudgeReadModel {
  return {
    id: row.id,
    senderId: row.senderId,
    receiverId: row.receiverId,
    todoId: row.todoId,
    message: row.message,
    readAt: row.readAt,
    createdAt: row.createdAt,
    replyKind: row.replyKind,
    repliedAt: row.repliedAt,
    replyUpdatedAt: row.replyUpdatedAt,
    thankedAt: row.thankedAt,
    sender: toNudgeUserReadModel(row.sender),
    receiver: toNudgeUserReadModel(row.receiver),
    todo: toNudgeInteractionTodoReadModel(row.todo),
  };
}

function thankedOnTodo(todoId: TodoId, receiverId: UserId): SQL | undefined {
  return and(
    eq(nudgeTable.todoId, todoId.value),
    eq(nudgeTable.receiverId, receiverId.value),
    isNotNull(nudgeTable.thankedAt),
  );
}

// 아직 고마움을 받지 않은 친구가 공개 할 일에 보낸 콕. 보낸 사람마다 묶으면 감사 후보 하나다
async function thanksCandidateCondition(
  db: NudgeQueryExecutor,
  query: NudgeThanksCandidateQuery,
): Promise<SQL | undefined> {
  const thanked = await db
    .select({ senderId: nudgeTable.senderId })
    .from(nudgeTable)
    .where(thankedOnTodo(query.todoId, query.ownerId));
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
      db
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

// 감사 저장(저장소)과 감사 미리보기(조회)가 같은 후보를 고르도록 한 곳에 둔다. id 내림차순이다
export async function listThanksCandidateIds(
  db: NudgeQueryExecutor,
  query: NudgeThanksCandidateQuery,
): Promise<number[]> {
  if (query.friendIds.length === 0) {
    return [];
  }
  const groups = await db
    .select({ latestId: max(nudgeTable.id) })
    .from(nudgeTable)
    .where(await thanksCandidateCondition(db, query))
    .groupBy(nudgeTable.senderId);
  return compact(groups.map((group) => group.latestId)).toSorted((left, right) => right - left);
}

@Injectable()
export class DrizzleNudgeReader implements NudgeReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  listReceived(params: ListNudgesParams): Promise<NudgeReadModel[]> {
    return this.#listOwned(params, "received");
  }

  listSent(params: ListNudgesParams): Promise<NudgeReadModel[]> {
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

  async findInteraction(nudgeId: NudgeId, viewerId: UserId): Promise<NudgeReadModel | null> {
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
    return row == null ? null : toNudgeReadModel(row);
  }

  async listInteractions(params: {
    readonly viewerId: UserId;
    readonly direction: NudgeDirection;
    readonly afterNudgeId: NudgeId | null;
    readonly limit: number;
  }): Promise<NudgeReadModel[]> {
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
    return rows.map(toNudgeReadModel);
  }

  async findInteractionTodo(
    todoId: TodoId,
    ownerId: UserId,
  ): Promise<NudgeInteractionTodoReadModel | null> {
    const row = await this.#db.query.todo.findFirst({
      columns: { id: true, userId: true, title: true, completed: true, visibility: true },
      where: { id: todoId.value, userId: ownerId.value },
    });
    return row == null ? null : toNudgeInteractionTodoReadModel(row);
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
      .where(thankedOnTodo(todoId, receiverId));
    return row?.count ?? 0;
  }

  async findLastThankedAt(todoId: TodoId, receiverId: UserId): Promise<Temporal.Instant | null> {
    const [row] = await this.#db
      .select({ lastThankedAt: max(nudgeTable.thankedAt) })
      .from(nudgeTable)
      .where(thankedOnTodo(todoId, receiverId));
    return row?.lastThankedAt ?? null;
  }

  async listThanksRecipients(
    query: NudgeThanksCandidateQuery & {
      readonly afterNudgeId: NudgeId | null;
      readonly limit: number | null;
    },
  ): Promise<NudgeThanksRecipientReadModel[]> {
    const ids = await listThanksCandidateIds(this.#db, query);
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
    return rows.map((row) => ({ nudgeId: row.id, sender: toNudgeUserReadModel(row.sender) }));
  }

  async countThanksRecipients(query: NudgeThanksCandidateQuery): Promise<number> {
    if (query.friendIds.length === 0) {
      return 0;
    }
    // 후보는 보낸 사람마다 하나라 id를 가져오지 않고 보낸 사람 수를 센다
    const [row] = await this.#db
      .select({ count: countDistinct(nudgeTable.senderId) })
      .from(nudgeTable)
      .where(await thanksCandidateCondition(this.#db, query));
    return row?.count ?? 0;
  }

  async #listOwned(params: ListNudgesParams, direction: NudgeDirection): Promise<NudgeReadModel[]> {
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
    return rows.map(toNudgeReadModel);
  }
}
