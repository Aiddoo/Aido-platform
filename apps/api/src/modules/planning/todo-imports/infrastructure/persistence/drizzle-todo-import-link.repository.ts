import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, gt, inArray } from "drizzle-orm";

import { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todoImportLink as todoImportLinkTable } from "#api/platform/database/schema/planning.schema";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  LinkedTodoPageQuery,
  TodoImportLink,
  TodoImportLinkRepositoryPort,
} from "../../application/ports/todo-import-link.repository.port.js";
import type { TodoImportId } from "../../domain/todo-import-id.vo.js";

@Injectable()
export class DrizzleTodoImportLinkRepository implements TodoImportLinkRepositoryPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  async listLinkedSourceKeys(
    userId: UserId,
    sourceKeys: readonly string[],
  ): Promise<ReadonlySet<string>> {
    if (sourceKeys.length === 0) {
      return new Set();
    }
    const rows = await this.#db
      .select({ sourceKey: todoImportLinkTable.sourceKey })
      .from(todoImportLinkTable)
      .where(
        and(
          eq(todoImportLinkTable.userId, userId.value),
          inArray(todoImportLinkTable.sourceKey, sourceKeys),
        ),
      );
    return new Set(rows.map((row) => row.sourceKey));
  }

  async insertMany(links: readonly TodoImportLink[]): Promise<void> {
    if (links.length === 0) {
      return;
    }
    await this.#db
      .insert(todoImportLinkTable)
      .values(
        links.map((link) => ({
          todoId: link.todoId.value,
          userId: link.userId.value,
          sourceKey: link.sourceKey,
          importId: link.importId.value,
          createdAt: link.createdAt,
        })),
      )
      .onConflictDoNothing();
  }

  async listTodoIds(query: LinkedTodoPageQuery): Promise<TodoId[]> {
    const rows = await this.#db
      .select({ todoId: todoImportLinkTable.todoId })
      .from(todoImportLinkTable)
      .where(
        and(
          eq(todoImportLinkTable.importId, query.importId.value),
          query.afterTodoId == null
            ? undefined
            : gt(todoImportLinkTable.todoId, query.afterTodoId.value),
        ),
      )
      .orderBy(asc(todoImportLinkTable.todoId))
      .limit(query.limit);
    return rows.map((row) => TodoId.reconstitute(row.todoId));
  }

  countByImportId(importId: TodoImportId): Promise<number> {
    return this.#db.$count(todoImportLinkTable, eq(todoImportLinkTable.importId, importId.value));
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
