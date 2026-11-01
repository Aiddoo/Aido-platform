import { ErrorCode } from "@aido/api/errors";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, count, eq, getTableColumns, gte, lte, max, sql } from "drizzle-orm";
import { isEmptyObject, isUndefined, omitBy } from "es-toolkit";

import {
  requireRecord,
  isUniqueConstraintViolation,
} from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo, todoCategory } from "#api/platform/database/schema/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type {
  CreateCategoryInput,
  TodoCategoryRepositoryPort,
  TodoCategoryWithCountView,
  UpdateCategoryInput,
} from "../../../application/ports/categories/todo-category.repository.port.js";
import { TodoCategory } from "../../../domain/aggregates/categories/todo-category.aggregate.js";

type TodoCategoryRow = typeof todoCategory.$inferSelect;
type TodoCategoryRowWithCount = TodoCategoryRow & { todos: number };

/**
 * TodoCategoryRepositoryPort의 Drizzle 어댑터.
 * 쓰기·단건은 TodoCategory 애그리게잇을, 개수 포함 읽기는 프로젝션을 반환한다.
 * 트랜잭션은 CLS(TransactionHost.tx)로 전파되며, 이름 유니크 위반(SQLSTATE 23505)은 TODO_CATEGORY_0853으로 번역한다.
 */
@Injectable()
export class DrizzleTodoCategoryRepository implements TodoCategoryRepositoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  private static toEntity(row: TodoCategoryRow): TodoCategory {
    return TodoCategory.reconstitute({
      id: row.id,
      userId: row.userId,
      name: row.name,
      color: row.color,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private static toView(row: TodoCategoryRowWithCount): TodoCategoryWithCountView {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      color: row.color,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      todoCount: row.todos,
    };
  }

  private selectWithCount() {
    return this.db
      .select({ ...getTableColumns(todoCategory), todos: count(todo.id) })
      .from(todoCategory)
      .leftJoin(todo, eq(todo.categoryId, todoCategory.id))
      .groupBy(todoCategory.id);
  }

  async create(input: CreateCategoryInput): Promise<TodoCategory> {
    try {
      const [row] = await this.db
        .insert(todoCategory)
        .values({
          userId: input.userId,
          name: input.name,
          color: input.color,
          sortOrder: input.sortOrder,
        })
        .returning();
      return DrizzleTodoCategoryRepository.toEntity(requireRecord(row));
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ApplicationException(ErrorCode.TODO_CATEGORY_0853, {
          name: input.name,
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
        const current = await this.db.query.todoCategory.findFirst({ where: { id } });
        return DrizzleTodoCategoryRepository.toEntity(requireRecord(current));
      }
      const [row] = await this.db
        .update(todoCategory)
        .set(values)
        .where(eq(todoCategory.id, id))
        .returning();
      return DrizzleTodoCategoryRepository.toEntity(requireRecord(row));
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
    const deleted = await this.db
      .delete(todoCategory)
      .where(eq(todoCategory.id, id))
      .returning({ id: todoCategory.id });
    requireRecord(deleted[0]);
  }

  async findByIdAndUserId(id: number, userId: string): Promise<TodoCategory | null> {
    const row = await this.db.query.todoCategory.findFirst({ where: { id, userId } });
    return row == null ? null : DrizzleTodoCategoryRepository.toEntity(row);
  }

  async findByIdWithCount(id: number): Promise<TodoCategoryWithCountView | null> {
    const [row] = await this.selectWithCount().where(eq(todoCategory.id, id));
    return row == null ? null : DrizzleTodoCategoryRepository.toView(row);
  }

  async findManyByUserId(userId: string): Promise<TodoCategoryWithCountView[]> {
    const rows = await this.selectWithCount()
      .where(eq(todoCategory.userId, userId))
      .orderBy(asc(todoCategory.sortOrder));
    return rows.map((row) => DrizzleTodoCategoryRepository.toView(row));
  }

  countByUserId(userId: string): Promise<number> {
    return this.db.$count(todoCategory, eq(todoCategory.userId, userId));
  }

  async existsByUserIdAndName(userId: string, name: string, excludeId?: number): Promise<boolean> {
    const row = await this.db.query.todoCategory.findFirst({
      columns: { id: true },
      where: { userId, name, ...(excludeId == null ? {} : { id: { ne: excludeId } }) },
    });
    return row != null;
  }

  async getMaxSortOrder(userId: string): Promise<number> {
    const [result] = await this.db
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
    const updated = await this.db
      .update(todoCategory)
      .set({ sortOrder: sql`${todoCategory.sortOrder} + ${delta}` })
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
    return this.db.$count(todo, eq(todo.categoryId, categoryId));
  }

  async moveTodosToCategory(fromCategoryId: number, toCategoryId: number): Promise<number> {
    const moved = await this.db
      .update(todo)
      .set({ categoryId: toCategoryId })
      .where(eq(todo.categoryId, fromCategoryId))
      .returning({ id: todo.id });
    return moved.length;
  }
}
