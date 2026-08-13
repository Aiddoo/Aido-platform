import {
	AI_SUGGESTION_LIMITS,
	DAY_OF_WEEK_KO,
	type DayOfWeek,
	dayIndexToDayOfWeek,
	reportStatsSchema,
} from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import dayjs from "dayjs";
import { subtractDays } from "@/shared/domain/date/utils/arithmetic";
import { now } from "@/shared/domain/date/utils/core";
import { type GridInput, WeatherForecastAccess } from "@/weather";
import type {
	SuggestionContext,
	SuggestionHistoryItem,
	TodoSummaryForAnalysis,
} from "../../domain/types";
import {
	AI_SUGGESTION_REPOSITORY,
	type AiSuggestionRepositoryPort,
} from "../ports/ai-suggestion.repository.port";
import {
	WEEKLY_REPORT_READER,
	type WeeklyReportReaderPort,
} from "../ports/weekly-report-reader.port";

const PRECIPITATION_KO: Record<string, string> = {
	RAIN: "비",
	SNOW: "눈",
	RAIN_SNOW: "비/눈",
	SHOWER: "소나기",
};

/**
 * AI 제안 생성을 위한 컨텍스트 수집 및 포맷 서비스
 *
 * 통계 분석을 서버에서 수행하여 AI에게 사전 계산된 인사이트를 제공합니다.
 */
@Injectable()
export class SuggestionContextBuilder {
	readonly #logger = new Logger(SuggestionContextBuilder.name);

	constructor(
		@Inject(AI_SUGGESTION_REPOSITORY)
		private readonly repository: AiSuggestionRepositoryPort,
		private readonly weatherForecastAccess: WeatherForecastAccess,
		@Inject(WEEKLY_REPORT_READER)
		private readonly reportReader: WeeklyReportReaderPort,
	) {}

	/**
	 * 사용자의 컨텍스트 데이터를 병렬 수집하여 포맷된 SuggestionContext를 반환합니다.
	 *
	 * @param weatherGrid dispatcher가 사전 조회한 KMA 격자 좌표 (위치 미설정 시 null)
	 */
	async build(
		userId: string,
		timezone: string,
		weatherGrid: GridInput | null,
	): Promise<SuggestionContext> {
		const currentDate = dayjs.utc(now());
		const analysisFrom = currentDate
			.subtract(AI_SUGGESTION_LIMITS.ANALYSIS_WEEKS, "week")
			.toDate();
		const contextFrom = currentDate
			.subtract(AI_SUGGESTION_LIMITS.CONTEXT_WEEKS, "week")
			.toDate();
		const to = currentDate.toDate();

		const historySince = subtractDays(30);

		const [
			todos,
			dayRates,
			timeRates,
			categoryRates,
			streakInfo,
			weather,
			weeklyReport,
			respondedSuggestions,
		] = await Promise.all([
			this.repository.findRecentTodos(userId, analysisFrom, to, timezone),
			this.repository.findDayCompletionRates(userId, contextFrom, to, timezone),
			this.repository.findTimeCompletionRates(
				userId,
				contextFrom,
				to,
				timezone,
			),
			this.repository.findCategoryCompletionRates(userId, contextFrom, to),
			this.repository.findUserStreakInfo(userId),
			this.#fetchWeatherByGrid(weatherGrid, to),
			this.reportReader.findLatestWeekly(userId),
			this.repository.findRecentResponded(userId, historySince),
		]);

		const missingRoutines = this.detectMissingRoutines(todos, timezone);

		// 보고서 인사이트 추출
		let weeklyReportInsight: string | null = null;
		if (weeklyReport) {
			const stats = reportStatsSchema.safeParse(weeklyReport.stats);
			if (stats.success) {
				weeklyReportInsight = `최근 주간 달성률: ${stats.data.completionRate}%, 스트릭: ${stats.data.streakDays}일`;
			}
		}

		// 수락/거절 이력 (포트가 이미 SuggestionHistoryItem 형태로 반환)
		const suggestionHistory: SuggestionHistoryItem[] = respondedSuggestions;

		return {
			todos,
			dayCompletionRates: this.#formatDayRates(dayRates),
			timeCompletionRates: this.#formatTimeRates(timeRates),
			categoryRates: this.#formatCategoryRates(categoryRates),
			streak: this.#formatStreak(streakInfo),
			missingRoutines,
			weather,
			currentDate: this.#formatCurrentDate(currentDate, timezone),
			weeklyReportInsight,
			suggestionHistory,
		};
	}

	/**
	 * 최근 투두에서 빠뜨린 루틴을 감지합니다.
	 *
	 * 같은 제목이 같은 요일에 2회 이상 등장했는데 이번 주에 없으면 "빠뜨린 루틴"으로 판정.
	 */
	detectMissingRoutines(
		todos: TodoSummaryForAnalysis[],
		timezone: string,
	): string[] {
		const currentDate = dayjs.utc(now()).tz(timezone);
		const weekStart = currentDate.startOf("week").add(1, "day"); // Monday

		// 제목+요일별 등장 횟수 집계 (이번 주 제외)
		const titleDayCount = new Map<string, Map<DayOfWeek, number>>();
		const thisWeekTitles = new Set<string>();

		for (const todo of todos) {
			const todoDate = dayjs(todo.startDate).tz(timezone);
			const dayName = dayIndexToDayOfWeek(todoDate.day());

			if (!todoDate.isBefore(weekStart, "day")) {
				thisWeekTitles.add(todo.title);
				continue;
			}

			if (!titleDayCount.has(todo.title)) {
				titleDayCount.set(todo.title, new Map());
			}
			const dayMap = titleDayCount.get(todo.title);
			if (!dayMap) continue;
			dayMap.set(dayName, (dayMap.get(dayName) ?? 0) + 1);
		}

		const missing: string[] = [];

		for (const [title, dayMap] of titleDayCount) {
			if (thisWeekTitles.has(title)) continue;

			for (const [day, count] of dayMap) {
				if (count >= 2) {
					const dayKo = DAY_OF_WEEK_KO[day] ?? day;
					missing.push(`${title}(매주 ${dayKo}요일에 했는데 이번 주 없음)`);
					break; // 같은 제목은 1번만
				}
			}
		}

		return missing;
	}

	/**
	 * KMA 격자 좌표로 날씨를 조회합니다.
	 *
	 * dispatcher가 사전 조회한 grid를 사용하므로 per-user UserLocation DB 조회가 불필요합니다.
	 * Redis batch API(mget/mset)를 활용하여 캐시 효율을 높입니다.
	 */
	async #fetchWeatherByGrid(
		grid: GridInput | null,
		date: Date,
	): Promise<string | null> {
		if (!grid) return null;

		try {
			const forecasts =
				await this.weatherForecastAccess.getForecastsByGridBatch([grid], date);
			const forecast = forecasts.get(`${grid.gridX}:${grid.gridY}`);
			if (!forecast) return null;

			if (forecast.precipitationType === "NONE") {
				return `맑음, ${forecast.temperatureMin}~${forecast.temperatureMax}°C`;
			}

			const precipKo =
				PRECIPITATION_KO[forecast.precipitationType] ??
				forecast.precipitationType;
			return `${precipKo}(강수확률 ${forecast.precipitationProbability}%), ${forecast.temperatureMin}~${forecast.temperatureMax}°C`;
		} catch {
			this.#logger.debug(`날씨 조회 실패: grid=${grid.gridX}:${grid.gridY}`);
			return null;
		}
	}

	#formatDayRates(
		rates: { day: DayOfWeek; total: number; completed: number }[],
	): string {
		return rates
			.map((r) => {
				const rate =
					r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0;
				return `${DAY_OF_WEEK_KO[r.day]}:${rate}%`;
			})
			.join("|");
	}

	#formatTimeRates(rates: {
		morning: { count: number; rate: number };
		afternoon: { count: number; rate: number };
	}): string {
		return `오전(~12시):${rates.morning.rate}%|오후(12시~):${rates.afternoon.rate}%`;
	}

	#formatCategoryRates(
		rates: { name: string; total: number; completed: number; rate: number }[],
	): string {
		if (rates.length === 0) return "없음";
		return rates.map((r) => `${r.name}:${r.rate}%`).join("|");
	}

	#formatStreak(
		info: { currentStreak: number; longestStreak: number } | null,
	): string {
		if (!info) return "정보 없음";
		return `현재 ${info.currentStreak}일 연속, 최장 ${info.longestStreak}일`;
	}

	#formatCurrentDate(date: dayjs.Dayjs, timezone: string): string {
		const local = date.tz(timezone);
		const dayKey = dayIndexToDayOfWeek(local.day());
		const dayKo = DAY_OF_WEEK_KO[dayKey];
		const month = local.month() + 1;
		const monthPart =
			local.date() <= 10
				? `${month}월 초`
				: local.date() <= 20
					? `${month}월 중순`
					: `${month}월 말`;
		return `${local.format("YYYY-MM-DD")} (${dayKo}요일, ${monthPart})`;
	}
}
