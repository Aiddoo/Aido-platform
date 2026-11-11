import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, count, eq, gte, isNotNull, lt } from "drizzle-orm";

import type { Database, DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo, todoCategory } from "#api/platform/database/schema/index";
import { instantToDate } from "#api/shared/domain/time/instant";
import { plainDateToDate } from "#api/shared/domain/time/plain-date";

import { localDateAt } from "../../../shared/domain/user-calendar.domain-service.js";
import { TodoStatsReaderPort } from "../../application/ports/todo-stats.reader.port.js";
import type { AggregateParams, AggregationInputs } from "../../domain/ai-report.constants.js";
import { toAggregationInputs } from "./report-aggregation.mapper.js";

interface ReportPeriod {
  userId: string;
  start: Temporal.PlainDate;
  end: Temporal.PlainDate;
}

function inPeriod({ userId, start, end }: ReportPeriod) {
  return and(eq(todo.userId, userId), gte(todo.startDate, start), lt(todo.startDate, end));
}

function selectDailyCounts(db: Database, period: ReportPeriod) {
  return db
    .select({ startDate: todo.startDate, completed: todo.completed, count: count() })
    .from(todo)
    .where(inPeriod(period))
    .groupBy(todo.startDate, todo.completed);
}

function selectPreviousCounts(db: Database, period: ReportPeriod) {
  return db
    .select({ completed: todo.completed, count: count() })
    .from(todo)
    .where(inPeriod(period))
    .groupBy(todo.completed);
}

function selectCategoryCounts(db: Database, period: ReportPeriod) {
  return db
    .select({ categoryId: todo.categoryId, completed: todo.completed, count: count() })
    .from(todo)
    .where(inPeriod(period))
    .groupBy(todo.categoryId, todo.completed);
}

function selectCategories(db: Database, userId: string) {
  return db
    .select({ id: todoCategory.id, name: todoCategory.name, color: todoCategory.color })
    .from(todoCategory)
    .where(eq(todoCategory.userId, userId));
}

function selectCompletedTodos(db: Database, period: ReportPeriod) {
  return db
    .select({ startDate: todo.startDate, completedAt: todo.completedAt })
    .from(todo)
    .where(and(inPeriod(period), eq(todo.completed, true), isNotNull(todo.completedAt)));
}

/** 고정된 5개 집계 쿼리를 활성 CLS transaction에서 실행한다. */
@Injectable()
export class DrizzleTodoStatsReader extends TodoStatsReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#txHost = txHost;
  }

  async fetchAggregationInputs(params: AggregateParams): Promise<AggregationInputs> {
    const { userId, startDate, endDate, prevStartDate, prevEndDate, timezone } = params;
    const db = this.#txHost.tx;
    const day = (value: Date) => localDateAt(value, timezone);
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
      daily.map((row) => ({ ...row, startDate: plainDateToDate(row.startDate) })),
      prev,
      category,
      categories,
      completed.map((row) => ({
        startDate: plainDateToDate(row.startDate),
        completedAt: row.completedAt == null ? null : instantToDate(row.completedAt),
      })),
    );
  }
}
