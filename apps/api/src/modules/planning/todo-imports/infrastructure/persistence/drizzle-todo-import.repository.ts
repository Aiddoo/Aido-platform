import { TODO_IMPORT_ACTIVE_STATUSES } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, lt } from "drizzle-orm";

import {
  databaseConstraint,
  isUniqueConstraintViolation,
} from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todoImport as todoImportTable } from "#api/platform/database/schema/planning.schema";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  TodoImportRepositoryPort,
  type StalledTodoImportQuery,
} from "../../application/ports/todo-import.repository.port.js";
import { todoImportAlreadyActiveConflict } from "../../application/todo-imports.errors.js";
import type { TodoImportId } from "../../domain/todo-import-id.vo.js";
import type { TodoImport } from "../../domain/todo-import.aggregate.js";
import { TODO_IMPORT_ENDED_STATUSES } from "../../domain/todo-imports.constants.js";
import { toTodoImport, toTodoImportRow } from "./todo-import-row.mapper.js";

const ACTIVE_IMPORT_CONSTRAINT = "TodoImport_userId_active_key";

@Injectable()
export class DrizzleTodoImportRepository implements TodoImportRepositoryPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  async findByIdAndUserId(importId: TodoImportId, userId: UserId): Promise<TodoImport | null> {
    const [row] = await this.#db
      .select()
      .from(todoImportTable)
      .where(and(eq(todoImportTable.id, importId.value), eq(todoImportTable.userId, userId.value)))
      .limit(1);
    return row == null ? null : toTodoImport(row);
  }

  async findById(importId: TodoImportId): Promise<TodoImport | null> {
    const [row] = await this.#db
      .select()
      .from(todoImportTable)
      .where(eq(todoImportTable.id, importId.value))
      .limit(1);
    return row == null ? null : toTodoImport(row);
  }

  async findByIdempotencyKey(userId: UserId, idempotencyKey: string): Promise<TodoImport | null> {
    const [row] = await this.#db
      .select()
      .from(todoImportTable)
      .where(
        and(
          eq(todoImportTable.userId, userId.value),
          eq(todoImportTable.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);
    return row == null ? null : toTodoImport(row);
  }

  async findActiveByUserId(userId: UserId): Promise<TodoImport | null> {
    const [row] = await this.#db
      .select()
      .from(todoImportTable)
      .where(
        and(
          eq(todoImportTable.userId, userId.value),
          inArray(todoImportTable.status, TODO_IMPORT_ACTIVE_STATUSES),
        ),
      )
      .limit(1);
    return row == null ? null : toTodoImport(row);
  }

  async listStalled(query: StalledTodoImportQuery): Promise<TodoImport[]> {
    const rows = await this.#db
      .select()
      .from(todoImportTable)
      .where(
        and(
          inArray(todoImportTable.status, query.statuses),
          lt(todoImportTable.updatedAt, query.updatedBefore),
        ),
      )
      .orderBy(asc(todoImportTable.updatedAt), asc(todoImportTable.id))
      .limit(query.limit);
    return rows.map(toTodoImport);
  }

  async save(todoImport: TodoImport): Promise<void> {
    const { id, userId, idempotencyKey, requestHash, createdAt, ...changes } =
      toTodoImportRow(todoImport);
    try {
      await this.#db
        .insert(todoImportTable)
        .values({ id, userId, idempotencyKey, requestHash, createdAt, ...changes })
        .onConflictDoUpdate({ target: todoImportTable.id, set: changes });
    } catch (error) {
      if (
        isUniqueConstraintViolation(error) &&
        databaseConstraint(error) === ACTIVE_IMPORT_CONSTRAINT
      ) {
        throw todoImportAlreadyActiveConflict();
      }
      throw error;
    }
  }

  async deleteEndedBefore(cutoff: Temporal.Instant, limit: number): Promise<number> {
    const endedImportIds = this.#db
      .select({ id: todoImportTable.id })
      .from(todoImportTable)
      .where(
        and(
          inArray(todoImportTable.status, TODO_IMPORT_ENDED_STATUSES),
          lt(todoImportTable.updatedAt, cutoff),
        ),
      )
      .limit(limit);
    const deleted = await this.#db
      .delete(todoImportTable)
      .where(inArray(todoImportTable.id, endedImportIds))
      .returning({ id: todoImportTable.id });
    return deleted.length;
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
