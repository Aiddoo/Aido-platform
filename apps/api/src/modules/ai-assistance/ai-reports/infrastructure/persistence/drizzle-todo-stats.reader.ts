import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, count, eq, isNotNull } from "drizzle-orm";

import { todoCategoriesOf } from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import { todosStartingBetween } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { Database, DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate, instantToDate } from "#api/shared/domain/time/instant";
import { plainDateToDate } from "#api/shared/domain/time/plain-date";
import { localDateIn } from "#api/shared/domain/time/timezone-name";

import { TodoStatsReaderPort } from "../../application/ports/todo-stats.reader.port.js";
import type { AggregateParams, AggregationInputs } from "../../domain/ai-reports.constants.js";
import { toAggregationInputs } from "./report-aggregation.mapper.js";

interface ReportPeriod {
  userId: UserId;
  start: Temporal.PlainDate;
  end: Temporal.PlainDate;
}

function inPeriod({ userId, start, end }: ReportPeriod) {
  return todosStartingBetween(userId, start, end);
}

function selectDailyCounts(db: Database, period: ReportPeriod) {
  const todos = inPeriod(period);
  return db
    .select({ startDate: todos.startDate, completed: todos.completed, count: count() })
    .from(todos)
    .groupBy(todos.startDate, todos.completed);
}

function selectPreviousCounts(db: Database, period: ReportPeriod) {
  const todos = inPeriod(period);
  return db
    .select({ completed: todos.completed, count: count() })
    .from(todos)
    .groupBy(todos.completed);
}

function selectCategoryCounts(db: Database, period: ReportPeriod) {
  const todos = inPeriod(period);
  return db
    .select({ categoryId: todos.categoryId, completed: todos.completed, count: count() })
    .from(todos)
    .groupBy(todos.categoryId, todos.completed);
}

function selectCategories(db: Database, userId: UserId) {
  const categories = todoCategoriesOf(userId);
  return db
    .select({ id: categories.id, name: categories.name, color: categories.color })
    .from(categories);
}

function selectCompletedTodos(db: Database, period: ReportPeriod) {
  const todos = inPeriod(period);
  return db
    .select({ startDate: todos.startDate, completedAt: todos.completedAt })
    .from(todos)
    .where(and(eq(todos.completed, true), isNotNull(todos.completedAt)));
}

/** 고정된 5개 집계 쿼리를 활성 CLS transaction에서 실행한다. */
@Injectable()
export class DrizzleTodoStatsReader extends TodoStatsReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#transactionHost = transactionHost;
  }

  async fetchAggregationInputs(params: AggregateParams): Promise<AggregationInputs> {
    const { startDate, endDate, prevStartDate, prevEndDate, timezone } = params;
    const userId = UserId.reconstitute(params.userId);
    const db = this.#transactionHost.tx;
    const day = (value: Date) => localDateIn(instantFromDate(value), timezone);
    const current = { userId, start: day(startDate), end: day(endDate) };
    const previous = { userId, start: day(prevStartDate), end: day(prevEndDate) };
    const [daily, prev, category, categories, completed] = await Promise.all([
      selectDailyCounts(db, current),
      selectPreviousCounts(db, previous),
      selectCategoryCounts(db, current),
      selectCategories(db, userId),
      selectCompletedTodos(db, current),
    ]);

    // 리포트 집계는 아직 UTC 자정 Date와 Date 순간으로 계산한다
    return toAggregationInputs(
      {
        daily: daily.map((row) => ({ ...row, startDate: plainDateToDate(row.startDate) })),
        previous: prev,
        category,
      },
      categories,
      completed.map((row) => ({
        startDate: plainDateToDate(row.startDate),
        completedAt: row.completedAt == null ? null : instantToDate(row.completedAt),
      })),
    );
  }
}
