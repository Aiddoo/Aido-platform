/**
 * AI 리포트 매퍼
 *
 * Prisma AiReport 엔티티를 응답 DTO로 변환하는 Static 메서드를 제공합니다.
 */

import type {
	AiReport as AiReportDto,
	CategoryBreakdownItem,
	DayPatternItem,
	ReportStats,
	TimePatternItem,
} from "@aido/validators";
import dayjs from "dayjs";
import { toDateString } from "@/common/date/utils/format";
import type { AiReport } from "@/generated/prisma/client";

/**
 * AI 리포트 매퍼 클래스
 *
 * Prisma 엔티티를 API 응답 형식으로 변환합니다.
 */
export abstract class AiReportMapper {
	/**
	 * 기간 라벨 생성
	 *
	 * @example
	 * computePeriodLabel("WEEKLY", 2026, 10)  → "2026년 10주차"
	 * computePeriodLabel("MONTHLY", 2026, 3)  → "2026년 3월"
	 */
	static computePeriodLabel(
		type: "WEEKLY" | "MONTHLY",
		year: number,
		period: number,
	): string {
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
			const monday = dayjs()
				.utc()
				.year(year)
				.isoWeek(period)
				.startOf("isoWeek");
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
			),
			dateRange: AiReportMapper.computeDateRange(
				type,
				entity.year,
				entity.period,
			),
			stats: entity.stats as unknown as ReportStats,
			categoryBreakdown:
				entity.categoryBreakdown as unknown as CategoryBreakdownItem[],
			dayPatterns: entity.dayPatterns as unknown as DayPatternItem[],
			timePatterns: entity.timePatterns as unknown as TimePatternItem[],
			aiSummary: entity.aiSummary,
			aiTips: entity.aiTips as unknown as string[],
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
}
