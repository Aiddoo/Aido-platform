import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoId } from "../../../shared/domain/todo-id.vo.js";
import type { TodoBriefReaderPort } from "../../application/ports/todo-brief.reader.port.js";
import type { TodoBriefReadModel } from "../../application/read-models/todo-brief.read-model.js";

const TODO_BRIEF_COLUMNS = {
  id: todo.id,
  userId: todo.userId,
  title: todo.title,
  completed: todo.completed,
  visibility: todo.visibility,
  startDate: todo.startDate,
  endDate: todo.endDate,
};

type TodoBriefRow = {
  readonly [Column in keyof typeof TODO_BRIEF_COLUMNS]: (typeof todo.$inferSelect)[Column];
};

function toTodoBriefReadModel(row: TodoBriefRow): TodoBriefReadModel {
  return {
    todoId: TodoId.reconstitute(row.id),
    ownerId: UserId.reconstitute(row.userId),
    title: row.title,
    completed: row.completed,
    visibility: row.visibility,
    startDate: row.startDate,
    endDate: row.endDate,
  };
}

@Injectable()
export class DrizzleTodoBriefReader implements TodoBriefReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  async findByIds(todoIds: readonly TodoId[]): Promise<TodoBriefReadModel[]> {
    if (todoIds.length === 0) {
      return [];
    }
    const rows = await this.#db
      .select(TODO_BRIEF_COLUMNS)
      .from(todo)
      .where(
        inArray(
          todo.id,
          todoIds.map((todoId) => todoId.value),
        ),
      );
    return rows.map(toTodoBriefReadModel);
  }

  async lockOwnedTodo(todoId: TodoId, ownerId: UserId): Promise<TodoBriefReadModel | null> {
    const [row] = await this.#db
      .select(TODO_BRIEF_COLUMNS)
      .from(todo)
      .where(and(eq(todo.id, todoId.value), eq(todo.userId, ownerId.value)))
      .limit(1)
      .for("update");
    return row == null ? null : toTodoBriefReadModel(row);
  }

  countTodosOn(ownerId: UserId, date: Temporal.PlainDate): Promise<number> {
    return this.#db.$count(
      todo,
      and(
        eq(todo.userId, ownerId.value),
        or(
          and(lte(todo.startDate, date), gte(todo.endDate, date)),
          and(eq(todo.startDate, date), isNull(todo.endDate)),
        ),
      ),
    );
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
