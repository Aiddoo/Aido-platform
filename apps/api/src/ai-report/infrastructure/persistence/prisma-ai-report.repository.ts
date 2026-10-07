import {
	categoryBreakdownItemSchema,
	dayPatternItemSchema,
	reportStatsSchema,
	timePatternItemSchema,
} from "@aido/validators";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { all, and } from "@prisma/orm-postgres/orm-client";
import { z } from "zod";

import { decodeRecord, encodeCreate } from "#api/shared/infrastructure/database/database-records";
import type * as PrismaModels from "#api/shared/infrastructure/database/database.types";
import { toInputJson } from "#api/shared/infrastructure/database/json.util";
import type { Prisma8TransactionalAdapter } from "#api/shared/infrastructure/database/prisma8-transactional.adapter";
import { toSupportedLocale } from "#api/shared/presentation/decorators/index";

import type {
	AiReportRepositoryPort,
	CreateAiReportInput,
	FindReportsParams,
} from "../../application/ports/ai-report.repository.port.js";
import { AiReport } from "../../domain/entities/ai-report.entity.js";
import type { ReportType } from "../../domain/types.js";

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
	constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

	/** 활성 트랜잭션(없으면 베이스 클라이언트) */
	private get client() {
		return this.txHost.tx;
	}

	async create(input: CreateAiReportInput): Promise<AiReport> {
		const row = decodeRecord(
			"AiReport",
			await this.client.orm.public.AiReport.create(
				encodeCreate("AiReport", {
					userId: input.userId,
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
				}),
			),
		);
		return PrismaAiReportRepository.toDomain(row);
	}

	async findByIdAndUserId(id: number, userId: string): Promise<AiReport | null> {
		const row = decodeRecord(
			"AiReport",
			await this.client.orm.public.AiReport.where((row) =>
				and(row.id.eq(id), row.userId.eq(userId)),
			).first(),
		);
		return row ? PrismaAiReportRepository.toDomain(row) : null;
	}

	async findLatest(userId: string, type: ReportType): Promise<AiReport | null> {
		const row = decodeRecord(
			"AiReport",
			await this.client.orm.public.AiReport.where((row) =>
				and(row.userId.eq(userId), row._type.eq(type)),
			)
				.orderBy((row) => row.generatedAt.desc())
				.first(),
		);
		return row ? PrismaAiReportRepository.toDomain(row) : null;
	}

	async findMany(params: FindReportsParams): Promise<AiReport[]> {
		const rows = decodeRecord(
			"AiReport",
			await this.client.orm.public.AiReport.where((row) =>
				and(row.userId.eq(params.userId), params.type ? row._type.eq(params.type) : all()),
			)
				.orderBy((row) => row.generatedAt.desc())
				.limit(params.limit)
				.all(),
		);
		return rows.map((row) => PrismaAiReportRepository.toDomain(row));
	}

	async exists(userId: string, type: ReportType, year: number, period: number): Promise<boolean> {
		const count = (
			await this.client.orm.public.AiReport.where((row) =>
				and(row.userId.eq(userId), row._type.eq(type), row.year.eq(year), row.period.eq(period)),
			).aggregate((aggregate) => ({ count: aggregate.count() }))
		).count;
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
			aiTips: PrismaAiReportRepository.parseArray(z.array(z.string()), row.aiTips),
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
