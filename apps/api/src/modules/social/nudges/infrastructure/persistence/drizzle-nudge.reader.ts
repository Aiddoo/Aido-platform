import type { NudgeDirection } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import {
  and,
  countDistinct,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
  max,
  notInArray,
  type SQL,
} from "drizzle-orm";
import { compact, keyBy, uniq } from "es-toolkit";

import {
  UserBriefReaderPort,
  type UserBriefReadModel,
} from "#api/modules/identity/users/identity-users.public";
import {
  TodoBriefReaderPort,
  type TodoBriefReadModel,
  TodoId,
} from "#api/modules/planning/todos/planning-todos-queries.public";
import { hasNoBlockWith } from "#api/modules/social/user-blocks/social-user-blocks.public";
import type { Database, DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { tupleLessThan } from "#api/platform/database/keyset";
import { nudge as nudgeTable } from "#api/platform/database/schema/index";
import {
  type CursorPage,
  emptyCursorPage,
  toMappedCursorPage,
} from "#api/shared/application/cursor-page";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  ListNudgesParams,
  NudgeReaderPort,
} from "../../application/ports/nudge.reader.port.js";
import type { NudgeThanksCandidateQuery } from "../../application/ports/nudge.repository.port.js";
import type {
  NudgeInteractionTodoReadModel,
  NudgeThanksRecipientReadModel,
} from "../../application/read-models/nudge-interaction.read-model.js";
import type { NudgeReadModel } from "../../application/read-models/nudge.read-model.js";
import { NudgeId } from "../../domain/nudge-id.vo.js";
import {
  toNudgeInteractionTodoReadModel,
  toNudgeReadModel,
  toNudgeUserReadModel,
} from "./nudge-row.mapper.js";

type NudgeRow = typeof nudgeTable.$inferSelect;
type NudgeQueryExecutor = Pick<Database, "select">;

function thankedOnTodo(todoId: TodoId, receiverId: UserId): SQL | undefined {
  return and(
    eq(nudgeTable.todoId, todoId.value),
    eq(nudgeTable.receiverId, receiverId.value),
    isNotNull(nudgeTable.thankedAt),
  );
}

// 감사는 받은 사람이 소유한 공개 할 일에서만 한다. 할 일은 planning이 소유해 조회 포트로 확인한다
async function isThanksTodo(
  todoBriefReader: Pick<TodoBriefReaderPort, "findByIds">,
  query: NudgeThanksCandidateQuery,
): Promise<boolean> {
  const [todo] = await todoBriefReader.findByIds([query.todoId]);
  return todo != null && todo.visibility === "PUBLIC" && todo.ownerId.equals(query.ownerId);
}

// 아직 고마움을 받지 않은 친구가 그 할 일에 보낸 콕. 보낸 사람마다 묶으면 감사 후보 하나다
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
  );
}

// 감사 저장(저장소)과 감사 미리보기(조회)가 같은 후보를 고르도록 한 곳에 둔다. id 내림차순이다
export async function listThanksCandidateIds(source: {
  readonly db: NudgeQueryExecutor;
  readonly todoBriefReader: Pick<TodoBriefReaderPort, "findByIds">;
  readonly query: NudgeThanksCandidateQuery;
}): Promise<number[]> {
  const { db, todoBriefReader, query } = source;
  if (query.friendIds.length === 0 || !(await isThanksTodo(todoBriefReader, query))) {
    return [];
  }
  const groups = await db
    .select({ latestId: max(nudgeTable.id) })
    .from(nudgeTable)
    .where(await thanksCandidateCondition(db, query))
    .groupBy(nudgeTable.senderId);
  return compact(groups.map((group) => group.latestId)).toSorted((left, right) => right - left);
}

// 콕 행은 이 Context에서 읽고, 보낸·받은 사람과 할 일은 identity·planning 조회 포트로 한 번씩 붙인다
@Injectable()
export class DrizzleNudgeReader implements NudgeReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #userBriefReader: UserBriefReaderPort;
  readonly #todoBriefReader: TodoBriefReaderPort;

  constructor(
    transactionHost: TransactionHost<DrizzleTransactionalAdapter>,
    userBriefReader: UserBriefReaderPort,
    todoBriefReader: TodoBriefReaderPort,
  ) {
    this.#transactionHost = transactionHost;
    this.#userBriefReader = userBriefReader;
    this.#todoBriefReader = todoBriefReader;
  }

  listReceived(params: ListNudgesParams): Promise<CursorPage<NudgeReadModel, number>> {
    return this.#listOwned(params, "received");
  }

  listSent(params: ListNudgesParams): Promise<CursorPage<NudgeReadModel, number>> {
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
    });
    if (row == null) {
      return null;
    }
    const [interaction] = await this.#toNudgeReadModels([row]);
    return interaction ?? null;
  }

  async listInteractions(params: {
    readonly viewerId: UserId;
    readonly direction: NudgeDirection;
    readonly afterNudgeId: NudgeId | null;
    readonly size: number;
  }): Promise<CursorPage<NudgeReadModel, number>> {
    const { viewerId, direction, afterNudgeId, size } = params;
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
      orderBy: { id: "desc" },
      limit: size + 1,
    });
    return toMappedCursorPage({
      rows,
      size,
      toCursor: (row) => row.id,
      toItems: (pageRows) => this.#toNudgeReadModels(pageRows),
    });
  }

  async findInteractionTodo(
    todoId: TodoId,
    ownerId: UserId,
  ): Promise<NudgeInteractionTodoReadModel | null> {
    const [todo] = await this.#todoBriefReader.findByIds([todoId]);
    if (todo == null || !todo.ownerId.equals(ownerId)) {
      return null;
    }
    return toNudgeInteractionTodoReadModel(todo);
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

  async listAllThanksRecipients(
    query: NudgeThanksCandidateQuery,
  ): Promise<NudgeThanksRecipientReadModel[]> {
    return this.#toThanksRecipients(await this.#thanksCandidateIds(query));
  }

  async listThanksRecipients(
    query: NudgeThanksCandidateQuery & {
      readonly afterNudgeId: NudgeId | null;
      readonly size: number;
    },
  ): Promise<CursorPage<NudgeThanksRecipientReadModel, number>> {
    const ids = await this.#thanksCandidateIds(query);
    const { afterNudgeId, size } = query;
    const remainingIds = afterNudgeId == null ? ids : ids.filter((id) => id < afterNudgeId.value);
    return toMappedCursorPage({
      rows: remainingIds.slice(0, size + 1),
      size,
      toCursor: (nudgeId) => nudgeId,
      toItems: (pageIds) => this.#toThanksRecipients(pageIds),
    });
  }

  async countThanksRecipients(query: NudgeThanksCandidateQuery): Promise<number> {
    if (query.friendIds.length === 0 || !(await isThanksTodo(this.#todoBriefReader, query))) {
      return 0;
    }
    // 후보는 보낸 사람마다 하나라 id를 가져오지 않고 보낸 사람 수를 센다
    const [row] = await this.#db
      .select({ count: countDistinct(nudgeTable.senderId) })
      .from(nudgeTable)
      .where(await thanksCandidateCondition(this.#db, query));
    return row?.count ?? 0;
  }

  async #listOwned(
    params: ListNudgesParams,
    direction: NudgeDirection,
  ): Promise<CursorPage<NudgeReadModel, number>> {
    const { userId, afterNudgeId, size } = params;
    // 커서는 콕 id 하나라 그 콕의 생성 시각을 먼저 읽어 (createdAt, id) 경계를 만든다
    const anchor =
      afterNudgeId == null
        ? null
        : await this.#db.query.nudge.findFirst({
            columns: { id: true, createdAt: true },
            where: { id: afterNudgeId.value },
          });
    if (afterNudgeId != null && anchor == null) {
      return emptyCursorPage(size);
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
      orderBy: { createdAt: "desc", id: "desc" },
      limit: size + 1,
    });
    return toMappedCursorPage({
      rows,
      size,
      toCursor: (row) => row.id,
      toItems: (pageRows) => this.#toNudgeReadModels(pageRows),
    });
  }

  #thanksCandidateIds(query: NudgeThanksCandidateQuery): Promise<number[]> {
    return listThanksCandidateIds({ db: this.#db, todoBriefReader: this.#todoBriefReader, query });
  }

  async #toThanksRecipients(nudgeIds: readonly number[]): Promise<NudgeThanksRecipientReadModel[]> {
    if (nudgeIds.length === 0) {
      return [];
    }
    const rows = await this.#db.query.nudge.findMany({
      columns: { id: true, senderId: true },
      where: { id: { in: [...nudgeIds] } },
      orderBy: { id: "desc" },
    });
    const senders = await this.#findUsers(rows.map((row) => row.senderId));
    return rows.flatMap((row) => {
      const sender = senders[row.senderId];
      return sender == null ? [] : [{ nudgeId: row.id, sender: toNudgeUserReadModel(sender) }];
    });
  }

  async #toNudgeReadModels(rows: readonly NudgeRow[]): Promise<NudgeReadModel[]> {
    const [users, todos] = await Promise.all([
      this.#findUsers(rows.flatMap((row) => [row.senderId, row.receiverId])),
      this.#findTodos(rows.map((row) => row.todoId)),
    ]);
    // 사람·할 일은 FK로 지워지면 콕도 함께 지워진다. 그 사이에 사라진 행은 목록에서 뺀다
    return rows.flatMap((row) => {
      const sender = users[row.senderId];
      const receiver = users[row.receiverId];
      const todo = todos[row.todoId];
      if (sender == null || receiver == null || todo == null) {
        return [];
      }
      return [toNudgeReadModel(row, { sender, receiver, todo })];
    });
  }

  async #findUsers(userIds: readonly string[]): Promise<Record<string, UserBriefReadModel>> {
    const briefs = await this.#userBriefReader.findByUserIds(
      uniq(userIds).map((userId) => UserId.reconstitute(userId)),
    );
    return keyBy(briefs, (brief) => brief.userId.value);
  }

  async #findTodos(todoIds: readonly number[]): Promise<Record<number, TodoBriefReadModel>> {
    const todos = await this.#todoBriefReader.findByIds(
      uniq(todoIds).map((todoId) => TodoId.reconstitute(todoId)),
    );
    return keyBy(todos, (todo) => todo.todoId.value);
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
