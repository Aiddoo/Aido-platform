import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

import { isUniqueConstraintViolation } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { aiReport } from "#api/platform/database/schema/ai-assistance.schema";
import { nextSequenceValue } from "#api/platform/database/sequence";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { AiReportRepositoryPort } from "../../application/ports/ai-report.repository.port.js";
import { DuplicateAiReportError } from "../../application/reports.errors.js";
import { AiReportId } from "../../domain/ai-report-id.vo.js";
import type { AiReport } from "../../domain/ai-report.aggregate.js";
import type { ReportType } from "../../domain/ai-report.constants.js";
import { toAiReport, toAiReportRow } from "./ai-report-row.mapper.js";

/** 트랜잭션은 CLS로 전파된다. jsonb 칸의 파싱은 행 매퍼가 소유한다. */
@Injectable()
export class DrizzleAiReportRepository extends AiReportRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async nextId(): Promise<AiReportId> {
    return AiReportId.reconstitute(await nextSequenceValue(this.#db, aiReport.id));
  }

  async save(report: AiReport): Promise<void> {
    const row = toAiReportRow(report);
    try {
      await this.#db
        .insert(aiReport)
        .values(row)
        .onConflictDoUpdate({ target: aiReport.id, set: row });
    } catch (error) {
      // AiReport_userId_type_year_period_key: 같은 주기 리포트를 다른 실행이 먼저 저장했다
      if (isUniqueConstraintViolation(error)) {
        throw new DuplicateAiReportError();
      }
      throw error;
    }
  }

  async findByIdAndUserId(reportId: AiReportId, userId: UserId): Promise<AiReport | null> {
    const row = await this.#db.query.aiReport.findFirst({
      where: { id: reportId.value, userId: userId.value },
    });
    return row == null ? null : toAiReport(row);
  }

  async findLatest(userId: UserId, type: ReportType): Promise<AiReport | null> {
    const row = await this.#db.query.aiReport.findFirst({
      where: { userId: userId.value, type },
      orderBy: { generatedAt: "desc", id: "desc" },
    });
    return row == null ? null : toAiReport(row);
  }

  async listByUserId(params: {
    readonly userId: UserId;
    readonly type: ReportType | null;
    readonly limit: number;
  }): Promise<AiReport[]> {
    const rows = await this.#db.query.aiReport.findMany({
      where: { userId: params.userId.value, ...(params.type == null ? {} : { type: params.type }) },
      orderBy: { generatedAt: "desc", id: "desc" },
      limit: params.limit,
    });
    return rows.map(toAiReport);
  }

  async existsForPeriod(params: {
    readonly userId: UserId;
    readonly type: ReportType;
    readonly year: number;
    readonly period: number;
  }): Promise<boolean> {
    const count = await this.#db.$count(
      aiReport,
      and(
        eq(aiReport.userId, params.userId.value),
        eq(aiReport.type, params.type),
        eq(aiReport.year, params.year),
        eq(aiReport.period, params.period),
      ),
    );
    return count > 0;
  }
}
