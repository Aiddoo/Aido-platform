import {
  categoryBreakdownItemSchema,
  dayPatternItemSchema,
  reportStatsSchema,
  timePatternItemSchema,
} from "@aido/api";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { aiReport } from "#api/platform/database/schema/index";
import { toSupportedLocale } from "#api/shared/domain/locale";

import type {
  AiReportRepositoryPort,
  CreateAiReportInput,
  FindReportsParams,
} from "../../../application/ports/reports/ai-report.repository.port.js";
import { AiReport } from "../../../domain/entities/reports/ai-report.entity.js";
import type { ReportType } from "../../../domain/types/reports/ai-report.types.js";

type AiReportRow = typeof aiReport.$inferSelect;

const DEFAULT_STATS = {
  totalTodos: 0,
  completedTodos: 0,
  completionRate: 0,
  prevCompletionRate: null,
  streakDays: 0,
} as const;

/**
 * AI 리포트 저장소 Drizzle 어댑터.
 *
 * 트랜잭션은 CLS로 전파된다 — TransactionHost.tx가 활성 트랜잭션 클라이언트를,
 * 없으면 베이스 클라이언트를 반환한다. jsonb 컬럼의 파싱은 어댑터가 소유한다.
 */
@Injectable()
export class DrizzleAiReportRepository implements AiReportRepositoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  async create(input: CreateAiReportInput): Promise<AiReport> {
    const [row] = await this.db.insert(aiReport).values(input).returning();
    return DrizzleAiReportRepository.toDomain(requireRecord(row));
  }

  async findByIdAndUserId(id: number, userId: string): Promise<AiReport | null> {
    const row = await this.db.query.aiReport.findFirst({ where: { id, userId } });
    return row == null ? null : DrizzleAiReportRepository.toDomain(row);
  }

  async findLatest(userId: string, type: ReportType): Promise<AiReport | null> {
    const row = await this.db.query.aiReport.findFirst({
      where: { userId, type },
      orderBy: { generatedAt: "desc" },
    });
    return row == null ? null : DrizzleAiReportRepository.toDomain(row);
  }

  async findMany(params: FindReportsParams): Promise<AiReport[]> {
    const rows = await this.db.query.aiReport.findMany({
      where: { userId: params.userId, ...(params.type == null ? {} : { type: params.type }) },
      orderBy: { generatedAt: "desc" },
      limit: params.limit,
    });
    return rows.map((row) => DrizzleAiReportRepository.toDomain(row));
  }

  async exists(userId: string, type: ReportType, year: number, period: number): Promise<boolean> {
    const count = await this.db.$count(
      aiReport,
      and(
        eq(aiReport.userId, userId),
        eq(aiReport.type, type),
        eq(aiReport.year, year),
        eq(aiReport.period, period),
      ),
    );
    return count > 0;
  }

  /** 행 → AiReport 애그리게잇 (jsonb 파싱 포함) */
  private static toDomain(row: AiReportRow): AiReport {
    return AiReport.reconstitute({
      id: row.id,
      userId: row.userId,
      type: row.type,
      year: row.year,
      period: row.period,
      stats: DrizzleAiReportRepository.parseStats(row.stats),
      categoryBreakdown: DrizzleAiReportRepository.parseArray(
        z.array(categoryBreakdownItemSchema),
        row.categoryBreakdown,
      ),
      dayPatterns: DrizzleAiReportRepository.parseArray(
        z.array(dayPatternItemSchema),
        row.dayPatterns,
      ),
      timePatterns: DrizzleAiReportRepository.parseArray(
        z.array(timePatternItemSchema),
        row.timePatterns,
      ),
      aiSummary: row.aiSummary,
      aiTips: DrizzleAiReportRepository.parseArray(z.array(z.string()), row.aiTips),
      locale: toSupportedLocale(row.locale),
      hasActivity: row.hasActivity,
      generatedAt: row.generatedAt,
    });
  }

  private static parseStats(raw: unknown) {
    const result = reportStatsSchema.safeParse(raw);
    return result.success ? result.data : { ...DEFAULT_STATS };
  }

  private static parseArray<T>(schema: z.ZodType<T[]>, raw: unknown): T[] {
    const result = schema.safeParse(raw);
    return result.success ? result.data : [];
  }
}
