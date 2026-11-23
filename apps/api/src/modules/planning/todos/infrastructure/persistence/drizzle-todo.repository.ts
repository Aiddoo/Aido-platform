import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  max,
  ne,
  notInArray,
  sql,
  type AnyColumn,
} from "drizzle-orm";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { tupleGreaterThan, tupleLessThan } from "#api/platform/database/keyset";
import { todo, todoItem, todoSeries } from "#api/platform/database/schema/index";
import { nextSequenceValue } from "#api/platform/database/sequence";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { toIsoString } from "#api/shared/domain/time/instant";

import { TODO_SORT_ORDER_GAP } from "../../../shared/domain/todo-sort-order.domain-service.js";
import type { TodoCategoryId } from "../../../todo-categories/domain/todo-category-id.vo.js";
import type {
  RebaseCandidate,
  RebaseCandidateQuery,
  RebasedInstant,
  TodoRepositoryPort,
  TodoSortEdge,
  TodoSortNeighborQuery,
} from "../../application/ports/todo.repository.port.js";
import { TodoId } from "../../domain/todo-id.vo.js";
import { TodoItemId } from "../../domain/todo-item-id.vo.js";
import type { TodoItemPrimitives } from "../../domain/todo-item.entity.js";
import type { Todo } from "../../domain/todo.aggregate.js";
import { toTodo, toTodoRow } from "./todo-row.mapper.js";

function excluded(column: AnyColumn) {
  return sql`excluded.${sql.identifier(column.name)}`;
}

@Injectable()
export class DrizzleTodoRepository implements TodoRepositoryPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #clock: ClockPort;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>, clock: ClockPort) {
    this.#transactionHost = transactionHost;
    this.#clock = clock;
  }

  async nextId(): Promise<TodoId> {
    return TodoId.reconstitute(await nextSequenceValue(this.#db, todo.id));
  }

  async nextItemId(): Promise<TodoItemId> {
    return TodoItemId.reconstitute(await nextSequenceValue(this.#db, todoItem.id));
  }

  async findByIdAndUserId(todoId: TodoId, userId: UserId): Promise<Todo | null> {
    const row = await this.#db.query.todo.findFirst({
      where: { id: todoId.value, userId: userId.value },
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
    return row == null ? null : toTodo(row);
  }

  async lockByIdAndUserId(todoId: TodoId, userId: UserId): Promise<Todo | null> {
    // 관계 조회(RQB)에는 행 잠금이 없어 잠금 문장을 먼저 보낸다
    const [locked] = await this.#db
      .select({ id: todo.id })
      .from(todo)
      .where(and(eq(todo.id, todoId.value), eq(todo.userId, userId.value)))
      .for("update");
    return locked == null ? null : this.findByIdAndUserId(todoId, userId);
  }

  async insert(entity: Todo): Promise<void> {
    await this.#db.insert(todo).values(toTodoRow(entity));
  }

  async createInlineItems(todoId: TodoId, items: readonly { title: string }[]): Promise<void> {
    if (items.length === 0) {
      return;
    }
    const updatedAt = this.#clock.now();
    await this.#db.insert(todoItem).values(
      items.map((item, sortOrder) => ({
        todoId: todoId.value,
        title: item.title,
        sortOrder,
        updatedAt,
      })),
    );
  }

  async save(entity: Todo): Promise<void> {
    const { id, userId: _userId, createdAt: _createdAt, items, ...columns } = entity.toPrimitives();
    const [updated] = await this.#db
      .update(todo)
      .set(columns)
      .where(eq(todo.id, id))
      .returning({ id: todo.id });
    requireRecord(updated);
    if (entity.hasChangedItems()) {
      await this.#saveItems(id, items);
    }
  }

  async delete(entity: Todo): Promise<void> {
    const [deleted] = await this.#db
      .delete(todo)
      .where(eq(todo.id, entity.id.value))
      .returning({ id: todo.id });
    requireRecord(deleted);
  }

  async findAdjacentSortOrder(
    userId: UserId,
    neighbor: TodoSortNeighborQuery,
  ): Promise<number | null> {
    const { from, direction, excludeId } = neighbor;
    const keyset = [todo.sortOrder, todo.id];
    const anchor = [from.sortOrder, from.id.value];
    const [row] = await this.#db
      .select({ sortOrder: todo.sortOrder })
      .from(todo)
      .where(
        and(
          eq(todo.userId, userId.value),
          ne(todo.id, excludeId.value),
          direction === "next" ? tupleGreaterThan(keyset, anchor) : tupleLessThan(keyset, anchor),
        ),
      )
      .orderBy(
        ...(direction === "next"
          ? [asc(todo.sortOrder), asc(todo.id)]
          : [desc(todo.sortOrder), desc(todo.id)]),
      )
      .limit(1);
    return row?.sortOrder ?? null;
  }

  async findEdgeSortOrder(
    userId: UserId,
    edge: TodoSortEdge,
    excludeId: TodoId,
  ): Promise<number | null> {
    const row = await this.#db.query.todo.findFirst({
      columns: { sortOrder: true },
      where: { userId: userId.value, id: { ne: excludeId.value } },
      orderBy: { sortOrder: edge === "first" ? "asc" : "desc" },
    });
    return row?.sortOrder ?? null;
  }

  async renumberSortOrders(userId: UserId): Promise<void> {
    // 순번은 창 함수(row_number)라 ORM 식이 없다. 지금 순서대로 1부터 매겨 간격을 곱한다
    const ranked = this.#db
      .select({
        id: todo.id,
        position: sql<number>`row_number() over (order by ${todo.sortOrder}, ${todo.id})`.as(
          "position",
        ),
      })
      .from(todo)
      .where(eq(todo.userId, userId.value))
      .as("ranked");
    await this.#db
      .update(todo)
      .set({
        sortOrder: sql`${ranked.position} * ${TODO_SORT_ORDER_GAP}`,
        updatedAt: this.#clock.now(),
      })
      .from(ranked)
      .where(eq(todo.id, ranked.id));
  }

  async getMaxSortOrder(userId: UserId): Promise<number> {
    const [result] = await this.#db
      .select({ maximum: max(todo.sortOrder) })
      .from(todo)
      .where(eq(todo.userId, userId.value));
    return result?.maximum ?? -1;
  }

  async countCategoryUsage(userId: UserId, categoryId: TodoCategoryId): Promise<number> {
    const todos = await this.#db.$count(
      todo,
      and(
        eq(todo.userId, userId.value),
        eq(todo.categoryId, categoryId.value),
        eq(todo.completed, false),
        isNull(todo.seriesId),
      ),
    );
    const series = await this.#db.$count(
      todoSeries,
      and(
        eq(todoSeries.userId, userId.value),
        eq(todoSeries.categoryId, categoryId.value),
        isNotNull(todoSeries.nextOccurrenceDate),
      ),
    );
    return todos + series;
  }

  async lockRebaseCandidates(query: RebaseCandidateQuery): Promise<readonly RebaseCandidate[]> {
    const rows = await this.#db
      .select({
        todoId: todo.id,
        startDate: todo.startDate,
        scheduledLocalTime: todo.scheduledLocalTime,
        scheduledTime: todo.scheduledTime,
        completed: todo.completed,
      })
      .from(todo)
      .where(
        and(
          eq(todo.userId, query.userId.value),
          isNotNull(todo.scheduledTime),
          isNotNull(todo.scheduledLocalTime),
          query.afterId == null ? undefined : gt(todo.id, query.afterId.value),
        ),
      )
      .orderBy(asc(todo.id))
      .limit(query.limit)
      .for("update");
    return rows.map((row) => ({
      ...row,
      todoId: TodoId.reconstitute(row.todoId),
      scheduledLocalTime: requireRecord(row.scheduledLocalTime),
      scheduledTime: requireRecord(row.scheduledTime),
    }));
  }

  async updateRebasedInstants(instants: readonly RebasedInstant[]): Promise<void> {
    if (instants.length === 0) {
      return;
    }
    const cases = sql.join(
      instants.map(
        ({ todoId, scheduledTime }) =>
          sql`WHEN ${todoId.value}::integer THEN ${toIsoString(scheduledTime)}::timestamptz`,
      ),
      sql` `,
    );
    await this.#db
      .update(todo)
      .set({ scheduledTime: sql`CASE ${todo.id} ${cases} END` })
      .where(
        inArray(
          todo.id,
          instants.map(({ todoId }) => todoId.value),
        ),
      );
  }

  // 빠진 하위 항목 지우기와 남은 항목 넣기·고치기를 데이터 변경 CTE 한 문장으로 한다
  async #saveItems(todoId: number, items: readonly TodoItemPrimitives[]): Promise<void> {
    if (items.length === 0) {
      await this.#db.delete(todoItem).where(eq(todoItem.todoId, todoId));
      return;
    }
    const removed = this.#db.$with("removed").as(
      this.#db
        .delete(todoItem)
        .where(
          and(
            eq(todoItem.todoId, todoId),
            notInArray(
              todoItem.id,
              items.map((item) => item.id),
            ),
          ),
        )
        .returning({ id: todoItem.id }),
    );
    await this.#db
      .with(removed)
      .insert(todoItem)
      .values(items.map((item) => ({ ...item, todoId })))
      .onConflictDoUpdate({
        target: todoItem.id,
        set: {
          title: excluded(todoItem.title),
          completed: excluded(todoItem.completed),
          sortOrder: excluded(todoItem.sortOrder),
          updatedAt: excluded(todoItem.updatedAt),
        },
      });
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
