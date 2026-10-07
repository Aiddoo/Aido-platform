import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and } from "@prisma/orm-postgres/orm-client";

import {
  decodeRecord,
  encodeCreate,
  encodePatch,
  type DatabaseCreate,
  type DatabasePatch,
} from "#api/platform/database/database-records";
import { databaseTimestamp, varchar } from "#api/platform/database/database-values";
import { requireRecord } from "#api/platform/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import { now } from "#api/shared/domain/date/utils/core";

import type { TodoAggregateRow } from "./todo-row.types.js";

/** Todo aggregate 로드와 저장. 조회 projection은 읽기 어댑터가 소유한다. */
@Injectable()
export class TodoRowRepository {
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

  async create(data: DatabaseCreate<"Todo">): Promise<TodoAggregateRow> {
    return decodeRecord("Todo", await this.todos.create(encodeCreate("Todo", data)));
  }

  async findByIdAndUserId(id: number, userId: string): Promise<TodoAggregateRow | null> {
    return decodeRecord(
      "Todo",
      await this.todos.where((row) => and(row.id.eq(id), row.userId.eq(userId))).first(),
    );
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
    fromSortOrder: number,
    toSortOrder: number | null,
    delta: number,
  ): Promise<number> {
    let query = this.client.sql.public.Todo.update((fields) => ({
      sortOrder: this.client.raw.sql`${fields.sortOrder} + ${delta}`.returns("pg/int4@1"),
      updatedAt: this.client.raw.sql`${databaseTimestamp(now())}`.returns("pg/timestamp-string@1"),
    })).where((fields, functions) =>
      functions.and(
        functions.eq(fields.userId, userId),
        functions.gte(fields.sortOrder, fromSortOrder),
      ),
    );
    if (toSortOrder !== null) {
      query = query.where((fields, functions) => functions.lte(fields.sortOrder, toSortOrder));
    }
    return (await this.client.execute(query.build())).affectedRows;
  }

  async update(id: number, data: DatabasePatch<"Todo">): Promise<void> {
    requireRecord(
      await this.client.orm.public.Todo.where({ id })
        .select("id")
        .update(encodePatch("Todo", data)),
    );
  }

  async delete(id: number): Promise<void> {
    requireRecord(await this.client.orm.public.Todo.where({ id }).select("id").delete());
  }

  async updateSortOrder(id: number, sortOrder: number): Promise<void> {
    await this.update(id, { sortOrder });
  }

  async createManyBatch(
    dataArray: DatabaseCreate<"Todo">[],
    recurrenceGroupId: string,
  ): Promise<TodoAggregateRow[]> {
    await this.client.orm.public.Todo.createAndCount(
      dataArray.map((data) => encodeCreate("Todo", data)),
    );
    return decodeRecord(
      "Todo",
      await this.todos
        .where({ recurrenceGroupId: varchar(recurrenceGroupId, 36) })
        .orderBy((row) => row.sortOrder.asc())
        .all(),
    );
  }

  async createManyItems(todoId: number, items: { title: string }[]): Promise<void> {
    if (items.length === 0) return;
    await this.client.orm.public.TodoItem.createAndCount(
      items.map((item, index) =>
        encodeCreate("TodoItem", { todoId, title: item.title, sortOrder: index }),
      ),
    );
  }

  async createItem(todoId: number, data: { title: string; sortOrder: number }): Promise<void> {
    await this.client.orm.public.TodoItem.select("id").create(
      encodeCreate("TodoItem", { todoId, ...data }),
    );
  }

  async updateItem(itemId: number, data: { title?: string; completed?: boolean }): Promise<void> {
    requireRecord(
      await this.client.orm.public.TodoItem.where({ id: itemId })
        .select("id")
        .update(encodePatch("TodoItem", data)),
    );
  }

  async deleteItem(itemId: number): Promise<void> {
    requireRecord(
      await this.client.orm.public.TodoItem.where({ id: itemId }).select("id").delete(),
    );
  }

  async reorderItems(itemIds: number[]): Promise<void> {
    await Promise.all(itemIds.map((id, index) => this.updateItemSortOrder(id, index)));
  }

  private async updateItemSortOrder(id: number, sortOrder: number): Promise<void> {
    requireRecord(
      await this.client.orm.public.TodoItem.where({ id })
        .select("id")
        .update(encodePatch("TodoItem", { sortOrder })),
    );
  }
}
