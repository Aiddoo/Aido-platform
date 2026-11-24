import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, lt } from "drizzle-orm";
import { groupBy, uniq } from "es-toolkit";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import {
  todoImport as todoImportTable,
  todoImportItem as todoImportItemTable,
} from "#api/platform/database/schema/planning.schema";

import type { TodoImportItemRepositoryPort } from "../../application/ports/todo-import-item.repository.port.js";
import type { TodoImportId } from "../../domain/todo-import-id.vo.js";
import type { TodoImportItem } from "../../domain/todo-import-item.vo.js";
import {
  TODO_IMPORT_ENDED_STATUSES,
  type TodoImportItemOutcome,
} from "../../domain/todo-imports.constants.js";
import { toTodoImportItem, toTodoImportItemRow } from "./todo-import-row.mapper.js";

@Injectable()
export class DrizzleTodoImportItemRepository implements TodoImportItemRepositoryPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  async insertMany(importId: TodoImportId, items: readonly TodoImportItem[]): Promise<number> {
    if (items.length === 0) {
      return 0;
    }
    const inserted = await this.#db
      .insert(todoImportItemTable)
      .values(items.map((item) => toTodoImportItemRow(importId, item)))
      .onConflictDoNothing({
        target: [todoImportItemTable.importId, todoImportItemTable.sourceKey],
      })
      .returning({ sourceKey: todoImportItemTable.sourceKey });
    return inserted.length;
  }

  async listPending(importId: TodoImportId, limit: number): Promise<TodoImportItem[]> {
    const rows = await this.#db
      .select({
        sourceKey: todoImportItemTable.sourceKey,
        collectionKey: todoImportItemTable.collectionKey,
        title: todoImportItemTable.title,
        startDate: todoImportItemTable.startDate,
        endDate: todoImportItemTable.endDate,
        localTime: todoImportItemTable.localTime,
      })
      .from(todoImportItemTable)
      .where(
        and(
          eq(todoImportItemTable.importId, importId.value),
          eq(todoImportItemTable.status, "PENDING"),
        ),
      )
      .orderBy(
        asc(todoImportItemTable.startDate),
        asc(todoImportItemTable.localTime),
        asc(todoImportItemTable.sourceKey),
      )
      .limit(limit);
    return rows.map(toTodoImportItem);
  }

  async markOutcomes(
    importId: TodoImportId,
    outcomes: ReadonlyMap<string, TodoImportItemOutcome>,
  ): Promise<void> {
    // 결과 종류마다 한 문장이다. 보통 만든 것과 건너뛴 것 한두 문장이다
    for (const outcome of uniq([...outcomes.values()])) {
      const sourceKeys = [...outcomes]
        .filter(([, candidate]) => candidate === outcome)
        .map(([sourceKey]) => sourceKey);
      await this.#db
        .update(todoImportItemTable)
        .set({ status: outcome })
        .where(
          and(
            eq(todoImportItemTable.importId, importId.value),
            inArray(todoImportItemTable.sourceKey, sourceKeys),
          ),
        );
    }
  }

  async deleteByImportId(importId: TodoImportId): Promise<void> {
    await this.#db
      .delete(todoImportItemTable)
      .where(eq(todoImportItemTable.importId, importId.value));
  }

  async deleteOfImportsEndedBefore(cutoff: Temporal.Instant, limit: number): Promise<number> {
    const rows = await this.#db
      .select({ importId: todoImportItemTable.importId, sourceKey: todoImportItemTable.sourceKey })
      .from(todoImportItemTable)
      .innerJoin(todoImportTable, eq(todoImportItemTable.importId, todoImportTable.id))
      .where(
        and(
          inArray(todoImportTable.status, TODO_IMPORT_ENDED_STATUSES),
          lt(todoImportTable.updatedAt, cutoff),
        ),
      )
      .limit(limit);
    // 고른 행은 보통 가져오기 한두 개에 몰려 있어 가져오기마다 한 문장으로 지운다
    const sourceKeysByImport = groupBy(rows, (row) => row.importId);
    for (const [importId, importRows] of Object.entries(sourceKeysByImport)) {
      await this.#db.delete(todoImportItemTable).where(
        and(
          eq(todoImportItemTable.importId, importId),
          inArray(
            todoImportItemTable.sourceKey,
            importRows.map((row) => row.sourceKey),
          ),
        ),
      );
    }
    return rows.length;
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
