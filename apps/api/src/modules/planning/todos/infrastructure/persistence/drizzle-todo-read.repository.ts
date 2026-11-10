import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, count, eq, gte, isNotNull, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { sumBy } from "es-toolkit";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo, todoCategory, todoSeries } from "#api/platform/database/schema/index";
import { plainDateFromDate } from "#api/shared/domain/time/plain-date";

import type {
  TodoPlanReaderPort,
  UpcomingTodoView,
} from "../../application/ports/todo-plan.reader.port.js";
import type {
  FindFriendTodosParams,
  FindTodosParams,
} from "../../application/ports/todo-read.repository.port.js";
import type { TodoReadRepositoryPort } from "../../application/ports/todo-read.repository.port.js";
import type {
  FriendTodoReadModel,
  TodoReadModel,
} from "../../application/read-models/todo.read-model.js";
import { toFriendTodoReadModel, toTodoReadModel } from "./todo-read-model.mapper.js";

/** Inclusive overlap. A single supplied boundary selects that exact calendar date. */
function todoDateCondition(
  startDate?: Temporal.PlainDate,
  endDate?: Temporal.PlainDate,
): SQL | undefined {
  const start = startDate ?? endDate;
  if (start == null) {
    return undefined;
  }
  const end = endDate ?? start;
  return or(
    and(isNotNull(todo.endDate), lte(todo.startDate, end), gte(todo.endDate, start)),
    and(isNull(todo.endDate), gte(todo.startDate, start), lte(todo.startDate, end)),
  );
}

const todoSeriesRuleColumns = {
  repeatFrequency: true,
  repeatInterval: true,
  repeatWeekdays: true,
  repeatMonthDay: true,
  repeatUntil: true,
  repeatCount: true,
} as const;

const friendTodoWith = {
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

const todoWith = {
  ...friendTodoWith,
  series: { columns: todoSeriesRuleColumns },
} as const;

function orderByIds<Row extends { id: number }>(rows: Row[], ids: readonly number[]): Row[] {
  const rowById = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = rowById.get(id);
    return row == null ? [] : [row];
  });
}

/** 조회 projection과 집계만 소유하며 활성 CLS transaction에 참여한다. */
@Injectable()
export class DrizzleTodoReadRepository implements TodoReadRepositoryPort, TodoPlanReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async findOwnerId(id: number): Promise<string | null> {
    const row = await this.#db.query.todo.findFirst({ columns: { userId: true }, where: { id } });
    return row?.userId ?? null;
  }

  async findManyByUserId(params: FindTodosParams): Promise<TodoReadModel[]> {
    const ids = await this.#findPageIds(params, false);
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.#db.query.todo.findMany({
      where: { id: { in: ids } },
      with: todoWith,
    });
    return orderByIds(rows, ids).map(toTodoReadModel);
  }

  async findPublicTodosByUserId(params: FindFriendTodosParams): Promise<FriendTodoReadModel[]> {
    const ids = await this.#findPageIds({ ...params, userId: params.friendUserId }, true);
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.#db.query.todo.findMany({
      where: { id: { in: ids } },
      with: friendTodoWith,
    });
    return orderByIds(rows, ids).map(toFriendTodoReadModel);
  }

  async #findPageIds(params: FindTodosParams, publicOnly: boolean): Promise<number[]> {
    const { userId, cursor, size, completed, categoryId, startDate, endDate } = params;
    let anchorCondition;
    if (cursor != null) {
      const anchor = await this.#db.query.todo.findFirst({
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

    const ids = await this.#db
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
    return ids.map((row) => row.id);
  }

  countCompletedByUser(userId: string): Promise<number> {
    return this.#db.$count(todo, and(eq(todo.userId, userId), eq(todo.completed, true)));
  }

  async getTodayTodoStats(
    userId: string,
    today: Temporal.PlainDate,
  ): Promise<{ total: number; completed: number }> {
    const groups = await this.#db
      .select({ completed: todo.completed, count: count() })
      .from(todo)
      .where(and(eq(todo.userId, userId), todoDateCondition(today, today)))
      .groupBy(todo.completed);
    return {
      total: sumBy(groups, (group) => group.count),
      completed: groups.find((group) => group.completed)?.count ?? 0,
    };
  }

  findTodayTopTodos(userId: string, today: Temporal.PlainDate, limit: number) {
    return this.#db
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

  async findManyBySeriesId(userId: string, seriesId: string): Promise<TodoReadModel[]> {
    const rows = await this.#db.query.todo.findMany({
      where: { userId, seriesId },
      with: todoWith,
      orderBy: { sortOrder: "asc" },
    });
    return rows.map(toTodoReadModel);
  }

  async findByIdAndUserId(id: number, userId: string): Promise<TodoReadModel | null> {
    const row = await this.#db.query.todo.findFirst({ where: { id, userId }, with: todoWith });
    return row == null ? null : toTodoReadModel(row);
  }

  async findManyByIds(userId: string, ids: readonly number[]): Promise<TodoReadModel[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.#db.query.todo.findMany({
      where: { userId, id: { in: [...ids] } },
      with: todoWith,
      orderBy: { sortOrder: "asc" },
    });
    return rows.map(toTodoReadModel);
  }

  async findUpcoming(
    userId: string,
    input: { readonly fromDate: Date; readonly limit: number },
  ): Promise<UpcomingTodoView[]> {
    const fromDate = plainDateFromDate(input.fromDate);
    // 반복 할 일은 회차가 수십 개라도 다음 회차 하나만 맥락에 넣는다.
    const groupKey = sql`coalesce(${todo.seriesId}, ${todo.id}::text)`;
    const upcoming = this.#db
      .selectDistinctOn([groupKey], {
        id: todo.id,
        title: todo.title,
        startDate: todo.startDate,
        seriesId: todo.seriesId,
      })
      .from(todo)
      .where(
        and(
          eq(todo.userId, userId),
          eq(todo.completed, false),
          or(gte(todo.startDate, fromDate), gte(todo.endDate, fromDate)),
        ),
      )
      .orderBy(groupKey, asc(todo.startDate), asc(todo.id))
      .as("upcoming");
    const rows = await this.#db
      .select()
      .from(upcoming)
      .orderBy(asc(upcoming.startDate), asc(upcoming.id))
      .limit(input.limit);
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      startDate: row.startDate.toString(),
      isRepeating: row.seriesId != null,
    }));
  }

  async countCategoryUsage(userId: string, categoryId: number): Promise<number> {
    const todos = await this.#db.$count(
      todo,
      and(
        eq(todo.userId, userId),
        eq(todo.categoryId, categoryId),
        eq(todo.completed, false),
        isNull(todo.seriesId),
      ),
    );
    const series = await this.#db.$count(
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
