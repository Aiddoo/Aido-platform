import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import { DatabaseService } from "#api/shared/infrastructure/database/database.service";
import type { Prisma8TransactionalAdapter } from "#api/shared/infrastructure/database/prisma8-transactional.adapter";

import type { TodoStatsReaderPort } from "../../application/ports/todo-stats.reader.port.js";
import type { AggregateParams, AggregationInputs } from "../../domain/types.js";
import { prepareReportQueries } from "./prisma8-report.queries.js";
import { toAggregationInputs } from "./report-aggregation.mapper.js";

/** 준비된 ORM 집계를 활성 CLS transaction에서 실행한다. */
@Injectable()
export class PrismaTodoStatsReader implements TodoStatsReaderPort {
  private queries: ReturnType<typeof prepareReportQueries> | undefined;

  constructor(
    private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>,
    private readonly prisma8: DatabaseService,
  ) {}

  async fetchAggregationInputs(params: AggregateParams): Promise<AggregationInputs> {
    const { userId, startDate, endDate, prevStartDate, prevEndDate } = params;
    const db = this.prisma8.db;
    // 초기화 실패는 다음 호출에서 재시도한다. 쿼리 형태만 재사용하며 데이터는 캐시하지 않는다.
    const queries = await (this.queries ??= prepareReportQueries(db).catch((error: unknown) => {
      this.queries = undefined;
      throw error;
    }));
    const date = (value: Date) => value.toISOString().slice(0, 10);
    const current = { userId, start: date(startDate), end: date(endDate) };
    const previous = { userId, start: date(prevStartDate), end: date(prevEndDate) };
    const runtime = this.txHost.tx;
    const [daily, prev, category, categories, completed] = await Promise.all([
      queries.daily.query(runtime, current),
      queries.previous.query(runtime, previous),
      queries.category.query(runtime, current),
      queries.categories.query(runtime, { userId }),
      queries.completed.query(runtime, current),
    ]);

    return toAggregationInputs(
      daily.map((row) => ({ ...row, startDate: new Date(`${row.startDate}T00:00:00.000Z`) })),
      prev,
      category,
      categories,

      completed.map((row) => ({
        startDate: new Date(`${row.startDate}T00:00:00.000Z`),
        completedAt: row.completedAt === null ? null : new Date(`${row.completedAt}Z`),
      })),
    );
  }
}
