import type { Todo as TodoResponse } from "@aido/api";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, count, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { sumBy } from "es-toolkit";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo, todoCategory, todoSeries } from "#api/platform/database/schema/index";

import type {
  FindFriendTodosParams,
  FindTodosParams,
} from "../../../application/models/todos/todo.types.js";
import type { TodoReadRepositoryPort } from "../../../application/ports/todos/todo-read.repository.port.js";
import { todoDateCondition } from "./todo-date.filter.js";
import { TodoMapper } from "./todo-response.mapper.js";

const todoWith = {
  category: { columns: { id: true, name: true, color: true, sortOrder: true } },
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
} as const;

/** 조회 projection과 집계만 소유하며 활성 CLS transaction에 참여한다. */
@Injectable()
export class DrizzleTodoReadRepository implements TodoReadRepositoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  async findOwnerId(id: number): Promise<string | null> {
    const row = await this.db.query.todo.findFirst({ columns: { userId: true }, where: { id } });
    return row?.userId ?? null;
  }

  async findManyByUserId(params: FindTodosParams): Promise<TodoResponse[]> {
    return this.findPage(params);
  }

  async findPublicTodosByUserId(params: FindFriendTodosParams): Promise<TodoResponse[]> {
    return this.findPage({ ...params, userId: params.friendUserId }, true);
  }

  private async findPage(params: FindTodosParams, publicOnly = false): Promise<TodoResponse[]> {
    const { userId, cursor, size, completed, categoryId, startDate, endDate } = params;
    let anchorCondition;
    if (cursor != null) {
      const anchor = await this.db.query.todo.findFirst({
        columns: { id: true, sortOrder: true },
        where: { id: cursor },
        with: { category: { columns: { sortOrder: true } } },
      });
      if (anchor == null) {
        return [];
      }
      const categoryOrder = requireRecord(anchor.category).sortOrder;
      anchorCondition = sql`(${todoCategory.sortOrder}, ${todo.sortOrder}, ${todo.id}) > (${categoryOrder}, ${anchor.sortOrder}, ${anchor.id})`;
    }

    const ids = await this.db
      .select({ id: todo.id })
      .from(todo)
      .innerJoin(todoCategory, eq(todo.categoryId, todoCategory.id))
      .where(
        and(
          eq(todo.userId, userId),
          completed == null ? undefined : eq(todo.completed, completed),
          categoryId == null ? undefined : eq(todo.categoryId, categoryId),
          publicOnly ? eq(todo.visibility, "PUBLIC") : undefined,
          todoDateCondition(startDate, endDate),
          anchorCondition,
        ),
      )
      .orderBy(asc(todoCategory.sortOrder), asc(todo.sortOrder), asc(todo.id))
      .limit(size + 1);
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.db.query.todo.findMany({
      where: { id: { in: ids.map((row) => row.id) } },
      with: todoWith,
    });
    const rowById = new Map(rows.map((row) => [row.id, row]));
    return TodoMapper.toManyResponse(
      ids.flatMap(({ id }) => {
        const row = rowById.get(id);
        return row == null ? [] : [row];
      }),
    );
  }

  countCompletedByUser(userId: string): Promise<number> {
    return this.db.$count(todo, and(eq(todo.userId, userId), eq(todo.completed, true)));
  }

  async getTodayTodoStats(
    userId: string,
    today: Date,
  ): Promise<{ total: number; completed: number }> {
    const groups = await this.db
      .select({ completed: todo.completed, count: count() })
      .from(todo)
      .where(and(eq(todo.userId, userId), todoDateCondition(today, today)))
      .groupBy(todo.completed);
    return {
      total: sumBy(groups, (group) => group.count),
      completed: groups.find((group) => group.completed)?.count ?? 0,
    };
  }

  findTodayTopTodos(userId: string, today: Date, limit: number) {
    return this.db
      .select({
        id: todo.id,
        title: todo.title,
        completed: todo.completed,
        categoryColor: todoCategory.color,
      })
      .from(todo)
      .innerJoin(todoCategory, eq(todo.categoryId, todoCategory.id))
      .where(and(eq(todo.userId, userId), todoDateCondition(today, today)))
      .orderBy(asc(todo.completed), asc(todoCategory.sortOrder), asc(todo.sortOrder), asc(todo.id))
      .limit(limit);
  }

  async findManyBySeriesId(userId: string, seriesId: string): Promise<TodoResponse[]> {
    const rows = await this.db.query.todo.findMany({
      where: { userId, seriesId },
      with: todoWith,
      orderBy: { sortOrder: "asc" },
    });
    return TodoMapper.toManyResponse(rows);
  }

  async findByIdAndUserId(id: number, userId: string): Promise<TodoResponse | null> {
    const row = await this.db.query.todo.findFirst({ where: { id, userId }, with: todoWith });
    return row == null ? null : TodoMapper.toResponse(row);
  }

  async countCategoryUsage(userId: string, categoryId: number): Promise<number> {
    const todos = await this.db.$count(
      todo,
      and(
        eq(todo.userId, userId),
        eq(todo.categoryId, categoryId),
        eq(todo.completed, false),
        isNull(todo.seriesId),
      ),
    );
    const series = await this.db.$count(
      todoSeries,
      and(
        eq(todoSeries.userId, userId),
        eq(todoSeries.categoryId, categoryId),
        isNotNull(todoSeries.nextOccurrenceDate),
      ),
    );
    return todos + series;
  }
}
