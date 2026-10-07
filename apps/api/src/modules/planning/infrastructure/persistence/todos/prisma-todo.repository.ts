import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { groupBy, sortBy } from "es-toolkit";

import {
  decodeRecord,
  encodeCreate,
  encodePatch,
  type DatabasePatch,
} from "#api/platform/database/database-records";
import { databaseTimestamp } from "#api/platform/database/database-values";
import { DatabaseRecordNotFoundError } from "#api/platform/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import { now } from "#api/shared/domain/date/utils/core";

import type {
  TodoRepositoryPort,
  TodoUpdatePatch,
} from "../../../application/ports/todos/todo.repository.port.js";
import {
  Todo,
  type TodoCreationPlan,
  type TodoVisibility,
} from "../../../domain/aggregates/todos/todo.aggregate.js";
import { TodoItem } from "../../../domain/entities/todos/todo-item.entity.js";
import { TodoId } from "../../../domain/value-objects/todos/todo-id.vo.js";
import {
  TodoSchedule,
  type TodoScheduleProps,
} from "../../../domain/value-objects/todos/todo-schedule.vo.js";
import type { TodoAggregateRow } from "./todo-row.types.js";

@Injectable()
export class PrismaTodoRepository implements TodoRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  private get client() {
    return this.txHost.tx;
  }

  private get todos() {
    return this.client.orm.public.Todo.include("items", (items) =>
      items
        .select("id", "title", "completed", "sortOrder", "createdAt", "updatedAt")
        .orderBy((item) => item.sortOrder.asc()),
    );
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
      recurrenceGroupId: row.recurrenceGroupId,
      items: row.items.map((item) => TodoItem.reconstitute(item)),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async findByIdAndUserId(id: number, userId: string): Promise<Todo | null> {
    const row = decodeRecord("Todo", await this.todos.where({ id, userId }).first());
    return row === null ? null : PrismaTodoRepository.toDomain(row);
  }

  async create(data: TodoCreationPlan): Promise<Todo> {
    const row = decodeRecord("Todo", await this.todos.create(encodeCreate("Todo", data)));
    return PrismaTodoRepository.toDomain(row);
  }

  async createInlineItems(todoId: number, items: { title: string }[]): Promise<void> {
    if (items.length === 0) return;
    await this.client.orm.public.TodoItem.createAndCount(
      items.map((item, sortOrder) =>
        encodeCreate("TodoItem", { todoId, title: item.title, sortOrder }),
      ),
    );
  }

  async createMany(
    items: readonly TodoCreationPlan[],
    recurrenceGroupId: string,
    inlineItems: readonly { title: string }[] = [],
  ): Promise<Todo[]> {
    const rows = decodeRecord(
      "Todo",
      await this.client.orm.public.Todo.createAll(
        items.map((item) => encodeCreate("Todo", { ...item, recurrenceGroupId })),
      ),
    );
    const itemRows =
      inlineItems.length === 0
        ? []
        : decodeRecord(
            "TodoItem",
            await this.client.orm.public.TodoItem.createAll(
              rows.flatMap((todo) =>
                inlineItems.map((item, sortOrder) =>
                  encodeCreate("TodoItem", {
                    todoId: todo.id,
                    title: item.title,
                    sortOrder,
                  }),
                ),
              ),
            ),
          );
    const itemsByTodoId = groupBy(itemRows, (item) => item.todoId);
    return sortBy(rows, [(row) => row.sortOrder]).map((row) =>
      PrismaTodoRepository.toDomain({
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

  private async updateTodoRow(id: number, patch: DatabasePatch<"Todo">): Promise<void> {
    const affected = await this.client.orm.public.Todo.where({ id }).updateAndCount(
      encodePatch("Todo", patch),
    );
    if (affected === 0) throw new DatabaseRecordNotFoundError();
  }

  async delete(id: number): Promise<void> {
    const affected = await this.client.orm.public.Todo.where({ id }).deleteAndCount();
    if (affected === 0) throw new DatabaseRecordNotFoundError();
  }

  async countActiveByCategory(userId: string, categoryId: number): Promise<number> {
    const { count } = await this.client.orm.public.Todo.where({
      userId,
      categoryId,
      completed: false,
    }).aggregate((aggregate) => ({ count: aggregate.count() }));
    return count;
  }

  async getMaxSortOrder(userId: string): Promise<number> {
    const { maximum } = await this.client.orm.public.Todo.where({ userId }).aggregate(
      (aggregate) => ({ maximum: aggregate.max("sortOrder") }),
    );
    return maximum ?? -1;
  }

  async shiftSortOrders(
    userId: string,
    from: number,
    to: number | null,
    delta: number,
  ): Promise<void> {
    let query = this.client.sql.public.Todo.update((fields) => ({
      sortOrder: this.client.raw.sql`${fields.sortOrder} + ${delta}`.returns("pg/int4@1"),
      updatedAt: this.client.raw.sql`${databaseTimestamp(now())}`.returns("pg/timestamp-string@1"),
    })).where((fields, functions) =>
      functions.and(functions.eq(fields.userId, userId), functions.gte(fields.sortOrder, from)),
    );
    if (to !== null)
      query = query.where((fields, functions) => functions.lte(fields.sortOrder, to));
    await this.client.execute(query.build());
  }

  async createItem(todoId: number, data: { title: string; sortOrder: number }): Promise<void> {
    await this.client.orm.public.TodoItem.select("id").create(
      encodeCreate("TodoItem", { todoId, ...data }),
    );
  }

  async updateItem(itemId: number, data: { title?: string; completed?: boolean }): Promise<void> {
    const affected = await this.client.orm.public.TodoItem.where({ id: itemId }).updateAndCount(
      encodePatch("TodoItem", data),
    );
    if (affected === 0) throw new DatabaseRecordNotFoundError();
  }

  async deleteItem(itemId: number): Promise<void> {
    const affected = await this.client.orm.public.TodoItem.where({ id: itemId }).deleteAndCount();
    if (affected === 0) throw new DatabaseRecordNotFoundError();
  }

  async reorderItems(itemIds: readonly number[]): Promise<void> {
    for (const [sortOrder, id] of itemIds.entries()) {
      const affected = await this.client.orm.public.TodoItem.where({ id }).updateAndCount(
        encodePatch("TodoItem", { sortOrder }),
      );
      if (affected === 0) throw new DatabaseRecordNotFoundError();
    }
  }
}
