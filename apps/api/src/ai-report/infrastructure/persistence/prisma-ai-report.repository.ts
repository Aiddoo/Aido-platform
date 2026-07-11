import {
	categoryBreakdownItemSchema,
	dayPatternItemSchema,
	reportStatsSchema,
	timePatternItemSchema,
} from "@aido/validators";
import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { z } from "zod";

import type * as PrismaModels from "@/generated/prisma/client";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { toInputJson } from "@/shared/infrastructure/database/json.util";
import { toSupportedLocale } from "@/shared/presentation/decorators";
import type {
	AiReportRepositoryPort,
	CreateAiReportInput,
	FindReportsParams,
} from "../../application/ports/ai-report.repository.port";
import { AiReport } from "../../domain/entities/ai-report.entity";
import type { ReportType } from "../../domain/types";

const DEFAULT_STATS = {
	totalTodos: 0,
	completedTodos: 0,
	completionRate: 0,
	prevCompletionRate: null,
	streakDays: 0,
} as const;

/**
 * AI 리포트 저장소 Prisma 어댑터.
 *
 * 트랜잭션은 CLS로 전파된다 — TransactionHost.tx가 활성 트랜잭션 클라이언트를,
 * 없으면 베이스 DatabaseService를 반환한다. Prisma Json 필드의 파싱/직렬화를 소유한다.
 */
@Injectable()
export class PrismaAiReportRepository implements AiReportRepositoryPort {
	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
	) {}

	/** 활성 트랜잭션(없으면 베이스 클라이언트) */
	private get client() {
		return this.txHost.tx;
	}

	async create(input: CreateAiReportInput): Promise<AiReport> {
		const row = await this.client.aiReport.create({
			data: {
				user: { connect: { id: input.userId } },
				type: input.type,
				year: input.year,
				period: input.period,
				stats: toInputJson(input.stats),
				categoryBreakdown: toInputJson(input.categoryBreakdown),
				dayPatterns: toInputJson(input.dayPatterns),
				timePatterns: toInputJson(input.timePatterns),
				aiSummary: input.aiSummary,
				aiTips: toInputJson(input.aiTips),
				locale: input.locale,
				hasActivity: input.hasActivity,
				generatedAt: input.generatedAt,
			},
		});
		return PrismaAiReportRepository.toDomain(row);
	}

	async findByIdAndUserId(
		id: number,
		userId: string,
	): Promise<AiReport | null> {
		const row = await this.client.aiReport.findFirst({
			where: { id, userId },
		});
		return row ? PrismaAiReportRepository.toDomain(row) : null;
	}

	async findLatest(userId: string, type: ReportType): Promise<AiReport | null> {
		const row = await this.client.aiReport.findFirst({
			where: { userId, type },
			orderBy: { generatedAt: "desc" },
		});
		return row ? PrismaAiReportRepository.toDomain(row) : null;
	}

	async findMany(params: FindReportsParams): Promise<AiReport[]> {
		const rows = await this.client.aiReport.findMany({
			where: {
				userId: params.userId,
				...(params.type && { type: params.type }),
			},
			orderBy: { generatedAt: "desc" },
			take: params.limit,
		});
		return rows.map((row) => PrismaAiReportRepository.toDomain(row));
	}

	async exists(
		userId: string,
		type: ReportType,
		year: number,
		period: number,
	): Promise<boolean> {
		const count = await this.client.aiReport.count({
			where: { userId, type, year, period },
		});
		return count > 0;
	}

	/** Prisma 행 → AiReport 애그리게잇 (Json 파싱 포함) */
	private static toDomain(row: PrismaModels.AiReport): AiReport {
		return AiReport.reconstitute({
			id: row.id,
			userId: row.userId,
			type: row.type,
			year: row.year,
			period: row.period,
			stats: PrismaAiReportRepository.parseStats(row.stats),
			categoryBreakdown: PrismaAiReportRepository.parseArray(
				z.array(categoryBreakdownItemSchema),
				row.categoryBreakdown,
			),
			dayPatterns: PrismaAiReportRepository.parseArray(
				z.array(dayPatternItemSchema),
				row.dayPatterns,
			),
			timePatterns: PrismaAiReportRepository.parseArray(
				z.array(timePatternItemSchema),
				row.timePatterns,
			),
			aiSummary: row.aiSummary,
			aiTips: PrismaAiReportRepository.parseArray(
				z.array(z.string()),
				row.aiTips,
			),
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
