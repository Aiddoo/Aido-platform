import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, getTableName, gte, lt, type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { nudge as nudgeTable, todo as todoTable } from "#api/platform/database/schema/index";
import { nextSequenceValue } from "#api/platform/database/sequence";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { DailySendWindow } from "../../../shared/domain/daily-send-window.domain-service.js";
import type {
  NudgeRepositoryPort,
  NudgeThanksCandidateQuery,
} from "../../application/ports/nudge.repository.port.js";
import type { NudgeInteractionTodoReadModel } from "../../application/read-models/nudge-interaction.read-model.js";
import { NudgeId } from "../../domain/nudge-id.vo.js";
import type { NudgeTargetTodo } from "../../domain/nudge-target-todo.vo.js";
import type { Nudge } from "../../domain/nudge.aggregate.js";
import { listThanksCandidateIds, toNudgeInteractionTodoReadModel } from "./drizzle-nudge.reader.js";
import { toNudge, toNudgeRow, toNudgeTargetTodo } from "./nudge-row.mapper.js";

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

function excludedValue(column: AnyPgColumn): SQL {
  return sql`excluded.${sql.identifier(column.name)}`;
}

// save·saveAll이 같은 칸 규칙으로 덮어쓴다. 답장은 새 값, 읽음·감사 시각은 먼저 남은 값이다
const NUDGE_UPSERT_SET = {
  readAt: keepStoredInstant(nudgeTable.readAt),
  replyKind: excludedValue(nudgeTable.replyKind),
  repliedAt: excludedValue(nudgeTable.repliedAt),
  replyUpdatedAt: excludedValue(nudgeTable.replyUpdatedAt),
  thankedAt: keepStoredInstant(nudgeTable.thankedAt),
};

@Injectable()
export class DrizzleNudgeRepository implements NudgeRepositoryPort {
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

  async listThanksCandidates(query: NudgeThanksCandidateQuery): Promise<Nudge[]> {
    const ids = await listThanksCandidateIds(this.#db, query);
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.#db.query.nudge.findMany({
      where: { id: { in: ids } },
      orderBy: { id: "desc" },
    });
    return rows.map(toNudge);
  }

  async save(nudge: Nudge): Promise<void> {
    await this.saveAll([nudge]);
  }

  async saveAll(nudges: readonly Nudge[]): Promise<void> {
    if (nudges.length === 0) {
      return;
    }
    await this.#db
      .insert(nudgeTable)
      .values(nudges.map(toNudgeRow))
      .onConflictDoUpdate({ target: nudgeTable.id, set: NUDGE_UPSERT_SET });
  }

  async findTargetTodo(todoId: TodoId): Promise<NudgeTargetTodo | null> {
    const row = await this.#db.query.todo.findFirst({
      columns: { userId: true, title: true, visibility: true, startDate: true, endDate: true },
      where: { id: todoId.value },
    });
    return row == null ? null : toNudgeTargetTodo(row);
  }

  async lockInteractionTodo(
    todoId: TodoId,
    ownerId: UserId,
  ): Promise<NudgeInteractionTodoReadModel | null> {
    const [row] = await this.#db
      .select(INTERACTION_TODO_COLUMNS)
      .from(todoTable)
      .where(and(eq(todoTable.id, todoId.value), eq(todoTable.userId, ownerId.value)))
      .limit(1)
      .for("update");
    return row == null ? null : toNudgeInteractionTodoReadModel(row);
  }
}
