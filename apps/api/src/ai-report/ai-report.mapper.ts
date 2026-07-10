/**
 * AI 리포트 매퍼
 *
 * Prisma AiReport 엔티티를 응답 DTO로 변환하는 Static 메서드를 제공합니다.
 */

import type { AiReport as AiReportDto } from "@aido/validators";
import {
	categoryBreakdownItemSchema,
	dayPatternItemSchema,
	reportStatsSchema,
	timePatternItemSchema,
} from "@aido/validators";
import dayjs from "dayjs";
import { z } from "zod";
import type { AiReport } from "@/generated/prisma/client";
import { toDateString } from "@/shared/domain/date/utils/format";
import {
	type SupportedLocale,
	toSupportedLocale,
} from "@/shared/presentation/decorators";

/**
 * AI 리포트 매퍼 클래스
 *
 * Prisma 엔티티를 API 응답 형식으로 변환합니다.
 */
const MONTH_NAMES_EN = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
] as const;

export abstract class AiReportMapper {
	/**
	 * 기간 라벨 생성 — 리포트 생성 언어(locale)에 맞춰 표기한다.
	 *
	 * @example
	 * computePeriodLabel("WEEKLY", 2026, 10)        → "2026년 10주차"
	 * computePeriodLabel("MONTHLY", 2026, 3)        → "2026년 3월"
	 * computePeriodLabel("WEEKLY", 2026, 10, "en")  → "Week 10, 2026"
	 * computePeriodLabel("MONTHLY", 2026, 3, "en")  → "March 2026"
	 */
	static computePeriodLabel(
		type: "WEEKLY" | "MONTHLY",
		year: number,
		period: number,
		locale: SupportedLocale = "ko",
	): string {
		if (locale === "en") {
			if (type === "WEEKLY") {
				return `Week ${period}, ${year}`;
			}
			return `${MONTH_NAMES_EN[period - 1]} ${year}`;
		}
		if (type === "WEEKLY") {
			return `${year}년 ${period}주차`;
		}
		return `${year}년 ${period}월`;
	}

	/**
	 * 날짜 범위 계산
	 *
	 * WEEKLY: ISO 주 기준 월요일 ~ 일요일
	 * MONTHLY: 해당 월 1일 ~ 마지막 날
	 */
	static computeDateRange(
		type: "WEEKLY" | "MONTHLY",
		year: number,
		period: number,
	): { startDate: string; endDate: string } {
		if (type === "WEEKLY") {
			// ISO week: 해당 연도, 해당 주차의 월요일 ~ 일요일
			const monday = dayjs.utc().year(year).isoWeek(period).startOf("isoWeek");
			const sunday = monday.endOf("isoWeek");
			return {
				startDate: toDateString(monday.toDate()),
				endDate: toDateString(sunday.toDate()),
			};
		}

		// MONTHLY: 해당 월 1일 ~ 마지막 날
		const monthStart = dayjs
			.utc()
			.year(year)
			.month(period - 1)
			.startOf("month");
		const monthEnd = monthStart.endOf("month");
		return {
			startDate: toDateString(monthStart.toDate()),
			endDate: toDateString(monthEnd.toDate()),
		};
	}

	/**
	 * Prisma AiReport 엔티티를 API 응답 형식으로 변환
	 */
	static toResponse(entity: AiReport): AiReportDto {
		const type = entity.type as "WEEKLY" | "MONTHLY";

		return {
			id: entity.id,
			type,
			year: entity.year,
			period: entity.period,
			periodLabel: AiReportMapper.computePeriodLabel(
				type,
				entity.year,
				entity.period,
				toSupportedLocale(entity.locale),
			),
			dateRange: AiReportMapper.computeDateRange(
				type,
				entity.year,
				entity.period,
			),
			stats: AiReportMapper.#parseStats(entity.stats),
			categoryBreakdown: AiReportMapper.#parseArray(
				z.array(categoryBreakdownItemSchema),
				entity.categoryBreakdown,
			),
			dayPatterns: AiReportMapper.#parseArray(
				z.array(dayPatternItemSchema),
				entity.dayPatterns,
			),
			timePatterns: AiReportMapper.#parseArray(
				z.array(timePatternItemSchema),
				entity.timePatterns,
			),
			aiSummary: entity.aiSummary,
			aiTips: AiReportMapper.#parseArray(z.array(z.string()), entity.aiTips),
			hasActivity: entity.hasActivity,
			generatedAt: entity.generatedAt.toISOString(),
		};
	}

	/**
	 * 여러 엔티티를 API 응답 형식으로 일괄 변환
	 */
	static toManyResponse(entities: AiReport[]): AiReportDto[] {
		return entities.map((entity) => AiReportMapper.toResponse(entity));
	}

	static #parseStats(raw: unknown) {
		const result = reportStatsSchema.safeParse(raw);
		if (result.success) return result.data;
		return {
			totalTodos: 0,
			completedTodos: 0,
			completionRate: 0,
			prevCompletionRate: null,
			streakDays: 0,
		};
	}

	static #parseArray<T>(schema: z.ZodType<T[]>, raw: unknown): T[] {
		const result = schema.safeParse(raw);
		return result.success ? result.data : [];
	}
}
