import { AI_SUGGESTION_LIMITS } from "@aido/validators";
import { Injectable, Logger } from "@nestjs/common";
import dayjs from "dayjs";
import { now } from "@/common/date/utils/core";
import { WeatherService } from "../weather/services/weather.service";
import { AiSuggestionRepository } from "./ai-suggestion.repository";
import type { SuggestionContext, TodoSummaryForAnalysis } from "./types";

const DAYS_KO: Record<string, string> = {
	MON: "월",
	TUE: "화",
	WED: "수",
	THU: "목",
	FRI: "금",
	SAT: "토",
	SUN: "일",
};

const DAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

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
		private readonly repository: AiSuggestionRepository,
		private readonly weatherService: WeatherService,
	) {}

	/**
	 * 사용자의 컨텍스트 데이터를 병렬 수집하여 포맷된 SuggestionContext를 반환합니다.
	 */
	async build(userId: string, timezone: string): Promise<SuggestionContext> {
		const currentDate = dayjs.utc(now());
		const analysisFrom = currentDate
			.subtract(AI_SUGGESTION_LIMITS.ANALYSIS_WEEKS, "week")
			.toDate();
		const contextFrom = currentDate
			.subtract(AI_SUGGESTION_LIMITS.CONTEXT_WEEKS, "week")
			.toDate();
		const to = currentDate.toDate();

		const [todos, dayRates, timeRates, categoryRates, streakInfo, weather] =
			await Promise.all([
				this.repository.findRecentTodos(userId, analysisFrom, to, timezone),
				this.repository.findDayCompletionRates(
					userId,
					contextFrom,
					to,
					timezone,
				),
				this.repository.findTimeCompletionRates(
					userId,
					contextFrom,
					to,
					timezone,
				),
				this.repository.findCategoryCompletionRates(userId, contextFrom, to),
				this.repository.findUserStreakInfo(userId),
				this.#fetchWeatherSafely(userId, to),
			]);

		const missingRoutines = this.detectMissingRoutines(todos, timezone);

		return {
			todos,
			dayCompletionRates: this.#formatDayRates(dayRates),
			timeCompletionRates: this.#formatTimeRates(timeRates),
			categoryRates: this.#formatCategoryRates(categoryRates),
			streak: this.#formatStreak(streakInfo),
			missingRoutines,
			weather,
			currentDate: this.#formatCurrentDate(currentDate, timezone),
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
		const titleDayCount = new Map<string, Map<string, number>>();
		const thisWeekTitles = new Set<string>();

		for (const todo of todos) {
			const todoDate = dayjs(todo.startDate).tz(timezone);
			const dayIndex = todoDate.day();
			const dayName = DAY_ORDER[(dayIndex + 6) % 7];
			if (!dayName) continue;

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
					const dayKo = DAYS_KO[day] ?? day;
					missing.push(`${title}(매주 ${dayKo}요일에 했는데 이번 주 없음)`);
					break; // 같은 제목은 1번만
				}
			}
		}

		return missing;
	}

	async #fetchWeatherSafely(
		userId: string,
		date: Date,
	): Promise<string | null> {
		try {
			const forecast = await this.weatherService.getForecastForUser(
				userId,
				date,
			);

			if (forecast.precipitationType === "NONE") {
				return `맑음, ${forecast.temperatureMin}~${forecast.temperatureMax}°C`;
			}

			const precipKo =
				PRECIPITATION_KO[forecast.precipitationType] ??
				forecast.precipitationType;
			return `${precipKo}(강수확률 ${forecast.precipitationProbability}%), ${forecast.temperatureMin}~${forecast.temperatureMax}°C`;
		} catch {
			this.#logger.debug(`날씨 조회 실패 (위치 미설정 등): userId=${userId}`);
			return null;
		}
	}

	#formatDayRates(
		rates: { day: string; total: number; completed: number }[],
	): string {
		return rates
			.map((r) => {
				const rate =
					r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0;
				return `${DAYS_KO[r.day] ?? r.day}:${rate}%`;
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
		const dayKey = DAY_ORDER[(local.day() + 6) % 7] ?? "MON";
		const dayKo = DAYS_KO[dayKey] ?? dayKey;
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
