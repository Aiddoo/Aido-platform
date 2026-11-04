import type { TodoVisibility } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, gte, inArray, lte, max, sql } from "drizzle-orm";
import { groupBy, isEmptyObject, isUndefined, omitBy, sortBy } from "es-toolkit";

import {
  DatabaseRecordNotFoundError,
  requireRecord,
} from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo, todoItem } from "#api/platform/database/schema/index";

import type {
  TodoRepositoryPort,
  TodoUpdatePatch,
} from "../../../application/ports/todos/todo.repository.port.js";
import { Todo, type TodoCreationPlan } from "../../../domain/aggregates/todos/todo.aggregate.js";
import { TodoItem } from "../../../domain/entities/todos/todo-item.entity.js";
import { TodoId } from "../../../domain/value-objects/todos/todo-id.vo.js";
import {
  TodoSchedule,
  type TodoScheduleProps,
} from "../../../domain/value-objects/todos/todo-schedule.vo.js";
import type { TodoAggregateRow } from "./todo-row.types.js";

type TodoPatch = Partial<typeof todo.$inferInsert>;

@Injectable()
export class DrizzleTodoRepository implements TodoRepositoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  private static toDomain(row: TodoAggregateRow): Todo {
    return Todo.reconstitute({
      id: TodoId.create(row.id),
      userId: row.userId,
      title: row.title,
      categoryId: row.categoryId,
      sortOrder: row.sortOrder,
      completed: row.completed,
      completedAt: row.completedAt,
      schedule: TodoSchedule.reconstitute({
        startDate: row.startDate,
        endDate: row.endDate,
        scheduledTime: row.scheduledTime,
        isAllDay: row.isAllDay,
      }),
      visibility: row.visibility,
      seriesId: row.seriesId,
      items: row.items.map((item) => TodoItem.reconstitute(item)),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async findByIdAndUserId(id: number, userId: string): Promise<Todo | null> {
    const row = await this.db.query.todo.findFirst({
      where: { id, userId },
      with: {
        items: {
          columns: {
            id: true,
            title: true,
            completed: true,
            sortOrder: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    return row == null ? null : DrizzleTodoRepository.toDomain(row);
  }

  async create(data: TodoCreationPlan): Promise<Todo> {
    const [row] = await this.db.insert(todo).values(data).returning();
    return DrizzleTodoRepository.toDomain({ ...requireRecord(row), items: [] });
  }

  async createInlineItems(todoId: number, items: readonly { title: string }[]): Promise<void> {
    if (items.length === 0) {
      return;
    }
    await this.db
      .insert(todoItem)
      .values(items.map((item, sortOrder) => ({ todoId, title: item.title, sortOrder })));
  }

  async createMany(
    items: readonly TodoCreationPlan[],
    seriesId: string,
    inlineItems: readonly { title: string }[] = [],
  ): Promise<Todo[]> {
    const rows = await this.db
      .insert(todo)
      .values(items.map((item) => ({ ...item, seriesId })))
      .returning();
    const itemRows =
      inlineItems.length === 0
        ? []
        : await this.db
            .insert(todoItem)
            .values(
              rows.flatMap((created) =>
                inlineItems.map((item, sortOrder) => ({
                  todoId: created.id,
                  title: item.title,
                  sortOrder,
                })),
              ),
            )
            .returning();
    const itemsByTodoId = groupBy(itemRows, (item) => item.todoId);
    return sortBy(rows, [(row) => row.sortOrder]).map((row) =>
      DrizzleTodoRepository.toDomain({
        ...row,
        items: sortBy(itemsByTodoId[row.id] ?? [], [(item) => item.sortOrder]),
      }),
    );
  }

  async updateCompletion(id: number, completed: boolean, completedAt: Date | null): Promise<void> {
    await this.updateDetails(id, { completed, completedAt });
  }

  async updateDetails(id: number, patch: TodoUpdatePatch): Promise<void> {
    await this.updateTodoRow(id, patch);
  }

  async updateTitle(id: number, title: string): Promise<void> {
    await this.updateDetails(id, { title });
  }

  async updateVisibility(id: number, visibility: TodoVisibility): Promise<void> {
    await this.updateDetails(id, { visibility });
  }

  async updateSchedule(id: number, schedule: TodoScheduleProps): Promise<void> {
    await this.updateDetails(id, schedule);
  }

  async updateCategory(id: number, categoryId: number): Promise<void> {
    await this.updateDetails(id, { categoryId });
  }

  async updateSortOrder(id: number, sortOrder: number): Promise<void> {
    await this.updateTodoRow(id, { sortOrder });
  }

  private async updateTodoRow(id: number, patch: TodoPatch): Promise<void> {
    const values = omitBy(patch, isUndefined);
    if (isEmptyObject(values)) {
      requireRecord(await this.db.query.todo.findFirst({ columns: { id: true }, where: { id } }));
      return;
    }
    const updated = await this.db
      .update(todo)
      .set(values)
      .where(eq(todo.id, id))
      .returning({ id: todo.id });
    requireRecord(updated[0]);
  }

  async delete(id: number): Promise<void> {
    const deleted = await this.db.delete(todo).where(eq(todo.id, id)).returning({ id: todo.id });
    requireRecord(deleted[0]);
  }

  countActiveByCategory(userId: string, categoryId: number): Promise<number> {
    return this.db.$count(
      todo,
      and(eq(todo.userId, userId), eq(todo.categoryId, categoryId), eq(todo.completed, false)),
    );
  }

  async getMaxSortOrder(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ maximum: max(todo.sortOrder) })
      .from(todo)
      .where(eq(todo.userId, userId));
    return result?.maximum ?? -1;
  }

  async shiftSortOrders(
    userId: string,
    from: number,
    to: number | null,
    delta: number,
  ): Promise<void> {
    await this.db
      .update(todo)
      .set({ sortOrder: sql`${todo.sortOrder} + ${delta}` })
      .where(
        and(
          eq(todo.userId, userId),
          gte(todo.sortOrder, from),
          to == null ? undefined : lte(todo.sortOrder, to),
        ),
      );
  }

  async createItem(todoId: number, data: { title: string; sortOrder: number }): Promise<void> {
    await this.db.insert(todoItem).values({ todoId, ...data });
  }

  async updateItem(itemId: number, data: { title?: string; completed?: boolean }): Promise<void> {
    const values = omitBy(data, isUndefined);
    if (isEmptyObject(values)) {
      requireRecord(
        await this.db.query.todoItem.findFirst({ columns: { id: true }, where: { id: itemId } }),
      );
      return;
    }
    const updated = await this.db
      .update(todoItem)
      .set(values)
      .where(eq(todoItem.id, itemId))
      .returning({ id: todoItem.id });
    requireRecord(updated[0]);
  }

  async deleteItem(itemId: number): Promise<void> {
    const deleted = await this.db
      .delete(todoItem)
      .where(eq(todoItem.id, itemId))
      .returning({ id: todoItem.id });
    requireRecord(deleted[0]);
  }

  async reorderItems(itemIds: readonly number[]): Promise<void> {
    if (itemIds.length === 0) {
      return;
    }
    // 행마다 다른 값을 쓰므로 CASE 한 문장으로 요청 순서를 갱신한다.
    const orders = sql.join(
      itemIds.map((id, sortOrder) => sql`WHEN ${id}::integer THEN ${sortOrder}::integer`),
      sql` `,
    );
    const updated = await this.db
      .update(todoItem)
      .set({ sortOrder: sql`CASE ${todoItem.id} ${orders} END` })
      .where(inArray(todoItem.id, [...itemIds]))
      .returning({ id: todoItem.id });
    if (updated.length !== itemIds.length) {
      throw new DatabaseRecordNotFoundError();
    }
  }
}
