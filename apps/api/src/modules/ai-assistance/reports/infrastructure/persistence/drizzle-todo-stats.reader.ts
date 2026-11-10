import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { startOfDayInTimezone } from "#api/shared/domain/date/utils/timezone";

import type { TodoStatsReaderPort } from "../../application/ports/todo-stats.reader.port.js";
import type { AggregateParams, AggregationInputs } from "../../domain/ai-report.constants.js";
import {
  selectCategories,
  selectCategoryCounts,
  selectCompletedTodos,
  selectDailyCounts,
  selectPreviousCounts,
} from "./drizzle-report-period.reader.js";
import { toAggregationInputs } from "./report-aggregation.mapper.js";

/** 고정된 5개 집계 쿼리를 활성 CLS transaction에서 실행한다. */
@Injectable()
export class DrizzleTodoStatsReader implements TodoStatsReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  async fetchAggregationInputs(params: AggregateParams): Promise<AggregationInputs> {
    const { userId, startDate, endDate, prevStartDate, prevEndDate, timezone } = params;
    const db = this.#txHost.tx;
    const day = (value: Date) => startOfDayInTimezone(value, timezone);
    const current = { userId, start: day(startDate), end: day(endDate) };
    const previous = { userId, start: day(prevStartDate), end: day(prevEndDate) };
    const [daily, prev, category, categories, completed] = await Promise.all([
      selectDailyCounts(db, current),
      selectPreviousCounts(db, previous),
      selectCategoryCounts(db, current),
      selectCategories(db, userId),
      selectCompletedTodos(db, current),
    ]);

    return toAggregationInputs(daily, prev, category, categories, completed);
  }
}
