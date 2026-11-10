import { ErrorCode } from "@aido/api/errors";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import {
  and,
  asc,
  count,
  eq,
  getTableColumns,
  gte,
  isNotNull,
  isNull,
  lte,
  max,
  sql,
} from "drizzle-orm";
import { isEmptyObject, isUndefined, omitBy } from "es-toolkit";

import {
  requireRecord,
  isUniqueConstraintViolation,
} from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo, todoCategory, todoSeries } from "#api/platform/database/schema/index";
import { nextSequenceValue } from "#api/platform/database/sequence";
import { ApplicationException } from "#api/shared/application/application.exception";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import type {
  TodoCategoryRepositoryPort,
  UpdateCategoryInput,
} from "../../application/ports/todo-category.repository.port.js";
import type { TodoCategoryWithCountReadModel } from "../../application/read-models/todo-category-with-count.read-model.js";
import { TodoCategoryId } from "../../domain/todo-category-id.vo.js";
import type { TodoCategory } from "../../domain/todo-category.aggregate.js";
import {
  toTodoCategory,
  toTodoCategoryRow,
  toTodoCategoryWithCountReadModel,
} from "./todo-category-row.mapper.js";

/**
 * TodoCategoryRepositoryPort의 Drizzle 어댑터.
 * 쓰기·단건은 TodoCategory 애그리게잇을, 개수 포함 읽기는 프로젝션을 반환한다.
 * 트랜잭션은 CLS(TransactionHost.tx)로 전파되며, 이름 유니크 위반(SQLSTATE 23505)은 TODO_CATEGORY_0853으로 번역한다.
 */
@Injectable()
export class DrizzleTodoCategoryRepository implements TodoCategoryRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #clock: ClockPort;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>, clock: ClockPort) {
    this.#txHost = txHost;
    this.#clock = clock;
  }

  get #db() {
    return this.#txHost.tx;
  }

  #selectWithCount() {
    return this.#db
      .select({ ...getTableColumns(todoCategory), todos: count(todo.id) })
      .from(todoCategory)
      .leftJoin(todo, eq(todo.categoryId, todoCategory.id))
      .groupBy(todoCategory.id);
  }

  async nextId(): Promise<TodoCategoryId> {
    return TodoCategoryId.reconstitute(await nextSequenceValue(this.#db, todoCategory.id));
  }

  async insert(category: TodoCategory): Promise<void> {
    try {
      await this.#db.insert(todoCategory).values(toTodoCategoryRow(category));
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ApplicationException(ErrorCode.TODO_CATEGORY_0853, {
          name: category.name.value,
        });
      }
      throw error;
    }
  }

  async update(id: number, input: UpdateCategoryInput): Promise<TodoCategory> {
    try {
      const values = omitBy(
        { name: input.name, color: input.color, sortOrder: input.sortOrder },
        isUndefined,
      );
      if (isEmptyObject(values)) {
        const current = await this.#db.query.todoCategory.findFirst({ where: { id } });
        return toTodoCategory(requireRecord(current));
      }
      const [row] = await this.#db
        .update(todoCategory)
        .set({ ...values, updatedAt: this.#clock.now() })
        .where(eq(todoCategory.id, id))
        .returning();
      return toTodoCategory(requireRecord(row));
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ApplicationException(ErrorCode.TODO_CATEGORY_0853, {
          name: input.name ?? "",
        });
      }
      throw error;
    }
  }

  async delete(id: number): Promise<void> {
    // 끝난 규칙은 사용자에게 보이지 않아 옮길 대상을 묻지 않는다. 카테고리와 함께 정리한다.
    await this.#db
      .delete(todoSeries)
      .where(and(eq(todoSeries.categoryId, id), isNull(todoSeries.nextOccurrenceDate)));
    const deleted = await this.#db
      .delete(todoCategory)
      .where(eq(todoCategory.id, id))
      .returning({ id: todoCategory.id });
    requireRecord(deleted[0]);
  }

  async findByIdAndUserId(id: number, userId: string): Promise<TodoCategory | null> {
    const row = await this.#db.query.todoCategory.findFirst({ where: { id, userId } });
    return row == null ? null : toTodoCategory(row);
  }

  async findByIdWithCount(id: number): Promise<TodoCategoryWithCountReadModel | null> {
    const [row] = await this.#selectWithCount().where(eq(todoCategory.id, id));
    return row == null ? null : toTodoCategoryWithCountReadModel(row);
  }

  async findManyByUserId(userId: string): Promise<TodoCategoryWithCountReadModel[]> {
    const rows = await this.#selectWithCount()
      .where(eq(todoCategory.userId, userId))
      .orderBy(asc(todoCategory.sortOrder), asc(todoCategory.id));
    return rows.map((row) => toTodoCategoryWithCountReadModel(row));
  }

  countByUserId(userId: string): Promise<number> {
    return this.#db.$count(todoCategory, eq(todoCategory.userId, userId));
  }

  async existsByUserIdAndName(userId: string, name: string, excludeId?: number): Promise<boolean> {
    const row = await this.#db.query.todoCategory.findFirst({
      columns: { id: true },
      where: { userId, name, ...(excludeId == null ? {} : { id: { ne: excludeId } }) },
    });
    return row != null;
  }

  async getMaxSortOrder(userId: string): Promise<number> {
    const [result] = await this.#db
      .select({ maximum: max(todoCategory.sortOrder) })
      .from(todoCategory)
      .where(eq(todoCategory.userId, userId));
    return result?.maximum ?? -1;
  }

  async shiftSortOrders(
    userId: string,
    fromSortOrder: number,
    toSortOrder: number | null,
    delta: number,
  ): Promise<number> {
    const updated = await this.#db
      .update(todoCategory)
      .set({ sortOrder: sql`${todoCategory.sortOrder} + ${delta}`, updatedAt: this.#clock.now() })
      .where(
        and(
          eq(todoCategory.userId, userId),
          gte(todoCategory.sortOrder, fromSortOrder),
          toSortOrder == null ? undefined : lte(todoCategory.sortOrder, toSortOrder),
        ),
      )
      .returning({ id: todoCategory.id });
    return updated.length;
  }

  getTodoCount(categoryId: number): Promise<number> {
    return this.#db.$count(todo, eq(todo.categoryId, categoryId));
  }

  countActiveSeries(categoryId: number): Promise<number> {
    return this.#db.$count(
      todoSeries,
      and(eq(todoSeries.categoryId, categoryId), isNotNull(todoSeries.nextOccurrenceDate)),
    );
  }

  async moveTodosToCategory(fromCategoryId: number, toCategoryId: number): Promise<void> {
    const updatedAt = this.#clock.now();
    await this.#db
      .update(todo)
      .set({ categoryId: toCategoryId, updatedAt })
      .where(eq(todo.categoryId, fromCategoryId));
    await this.#db
      .update(todoSeries)
      .set({ categoryId: toCategoryId, updatedAt })
      .where(eq(todoSeries.categoryId, fromCategoryId));
  }
}
