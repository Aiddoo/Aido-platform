import {
  AI_SUGGESTION_LIMITS,
  type DayOfWeek,
  dayIndexToDayOfWeek,
  reportStatsSchema,
} from "@aido/api";
import dayjs from "dayjs";

import type { WeatherForecastReaderPort } from "#api/modules/weather/weather-forecast.public";
import { type GridInput } from "#api/modules/weather/weather-forecast.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { subtractDays } from "#api/shared/domain/date/utils/arithmetic";
import { now } from "#api/shared/domain/date/utils/core";
import { parseLocalDateTime } from "#api/shared/domain/date/utils/timezone";
import type { SupportedLocale } from "#api/shared/domain/locale";

import { collectRecordedActivities } from "../../../domain/services/suggestions/recorded-activity-evidence.js";
import type {
  SuggestionHistoryItem,
  TodoSummaryForAnalysis,
} from "../../../domain/types/suggestions/ai-suggestion.types.js";
import { suggestionContextTranslations } from "../../locale/suggestions/suggestion-context.locale.js";
import { AiSuggestionLogEvent } from "../../observability/suggestions/ai-suggestion-log.events.js";
import { type AiSuggestionRepositoryPort } from "../../ports/suggestions/ai-suggestion.repository.port.js";
import { type WeeklyReportReaderPort } from "../../ports/suggestions/weekly-report-reader.port.js";
import type { SuggestionContext } from "../../types/suggestions/suggestion-context.js";

/**
 * AI 제안 생성을 위한 컨텍스트 수집 및 포맷 서비스
 *
 * 통계 분석을 서버에서 수행하여 AI에게 사전 계산된 인사이트를 제공합니다.
 */
interface SuggestionContextBuilderDependencies {
  readonly repository: Pick<
    AiSuggestionRepositoryPort,
    | "findRecentTodos"
    | "findDayCompletionRates"
    | "findTimeCompletionRates"
    | "findCategoryCompletionRates"
    | "findUserStreakInfo"
    | "findRecentResponded"
  >;
  readonly weatherForecastReader: Pick<WeatherForecastReaderPort, "getForecastsByGridBatch">;
  readonly reportReader: Pick<WeeklyReportReaderPort, "findLatestWeekly">;
  readonly logger: Pick<ApplicationLogger, "debug">;
}

export class SuggestionContextBuilder {
  readonly #dependencies: SuggestionContextBuilderDependencies;

  constructor(dependencies: SuggestionContextBuilderDependencies) {
    this.#dependencies = dependencies;
  }

  /**
   * 사용자의 컨텍스트 데이터를 병렬 수집하여 포맷된 SuggestionContext를 반환합니다.
   *
   * @param weatherGrid dispatcher가 사전 조회한 KMA 격자 좌표 (위치 미설정 시 null)
   */
  async build(
    userId: string,
    timezone: string,
    weatherGrid: GridInput | null,
    locale: SupportedLocale = "ko",
  ): Promise<SuggestionContext> {
    const currentDate = dayjs.utc(now());
    const analysisFrom = currentDate.subtract(AI_SUGGESTION_LIMITS.ANALYSIS_WEEKS, "week").toDate();
    const contextFrom = currentDate.subtract(AI_SUGGESTION_LIMITS.CONTEXT_WEEKS, "week").toDate();
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
      this.#dependencies.repository.findRecentTodos(userId, analysisFrom, to, timezone),
      this.#dependencies.repository.findDayCompletionRates(userId, contextFrom, to, timezone),
      this.#dependencies.repository.findTimeCompletionRates(userId, contextFrom, to, timezone),
      this.#dependencies.repository.findCategoryCompletionRates(userId, contextFrom, to, timezone),
      this.#dependencies.repository.findUserStreakInfo(userId),
      this.#fetchWeatherByGrid(weatherGrid, to, locale),
      this.#dependencies.reportReader.findLatestWeekly(userId),
      this.#dependencies.repository.findRecentResponded(userId, historySince),
    ]);

    const missingRoutines = this.detectMissingRoutines(todos, timezone, locale);

    // 보고서 인사이트 추출
    let weeklyReportInsight: string | null = null;
    if (weeklyReport !== null) {
      const stats = reportStatsSchema.safeParse(weeklyReport.stats);
      if (stats.success) {
        weeklyReportInsight = suggestionContextTranslations[locale].reportInsight(
          stats.data.completionRate,
          stats.data.streakDays,
        );
      }
    }

    // 수락/거절 이력 (포트가 이미 SuggestionHistoryItem 형태로 반환)
    const suggestionHistory: SuggestionHistoryItem[] = respondedSuggestions;

    return {
      todos,
      recordedActivities: collectRecordedActivities(todos),
      dayCompletionRates: this.#formatDayRates(dayRates, locale),
      timeCompletionRates: this.#formatTimeRates(timeRates, locale),
      categoryRates: this.#formatCategoryRates(categoryRates, locale),
      streak: this.#formatStreak(streakInfo, locale),
      missingRoutines,
      weather,
      currentDate: this.#formatCurrentDate(currentDate, timezone, locale),
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
    todos: readonly TodoSummaryForAnalysis[],
    timezone: string,
    locale: SupportedLocale = "ko",
  ): string[] {
    const currentDate = dayjs.utc(now()).tz(timezone);
    const weekStart = currentDate.startOf("isoWeek");

    // 제목+요일별 등장 횟수 집계 (이번 주 제외)
    const titleDayCount = new Map<string, Map<DayOfWeek, number>>();
    const thisWeekTitles = new Set<string>();

    for (const todo of todos) {
      const todoDate = dayjs(parseLocalDateTime(todo.startDate, "00:00", timezone)).tz(timezone);
      const dayName = dayIndexToDayOfWeek(todoDate.day());

      if (!todoDate.isBefore(weekStart, "day")) {
        thisWeekTitles.add(todo.title);
        continue;
      }

      if (!titleDayCount.has(todo.title)) {
        titleDayCount.set(todo.title, new Map());
      }
      const dayMap = titleDayCount.get(todo.title);
      if (dayMap === undefined) continue;
      dayMap.set(dayName, (dayMap.get(dayName) ?? 0) + 1);
    }

    const missing: string[] = [];

    for (const [title, dayMap] of titleDayCount) {
      if (thisWeekTitles.has(title)) continue;

      for (const [day, count] of dayMap) {
        if (count >= 2) {
          missing.push(suggestionContextTranslations[locale].missingRoutine(title, day));
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
    locale: SupportedLocale,
  ): Promise<string | null> {
    if (grid === null) return null;

    try {
      const forecasts = await this.#dependencies.weatherForecastReader.getForecastsByGridBatch(
        [grid],
        date,
      );
      const forecast = forecasts.get(`${grid.gridX}:${grid.gridY}`);
      if (forecast === undefined) return null;

      const translations = suggestionContextTranslations[locale];
      const description =
        forecast.precipitationType === "NONE"
          ? translations.clear
          : (translations.precipitation[forecast.precipitationType] ?? forecast.precipitationType);
      return translations.weather(
        description,
        forecast.temperatureMin,
        forecast.temperatureMax,
        forecast.precipitationType === "NONE" ? undefined : forecast.precipitationProbability,
      );
    } catch {
      this.#dependencies.logger.debug({
        event: AiSuggestionLogEvent.WEATHER_UNAVAILABLE,
        gridX: grid.gridX,
        gridY: grid.gridY,
      });
      return null;
    }
  }

  #formatDayRates(
    rates: readonly {
      readonly day: DayOfWeek;
      readonly total: number;
      readonly completed: number;
    }[],
    locale: SupportedLocale,
  ): string {
    return rates
      .map((r) => {
        const rate = r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0;
        return `${suggestionContextTranslations[locale].days[r.day]}:${rate}%`;
      })
      .join("|");
  }

  #formatTimeRates(
    rates: {
      morning: { count: number; rate: number };
      afternoon: { count: number; rate: number };
    },
    locale: SupportedLocale,
  ): string {
    const translations = suggestionContextTranslations[locale];
    return `${translations.morning}:${rates.morning.rate}%|${translations.afternoon}:${rates.afternoon.rate}%`;
  }

  #formatCategoryRates(
    rates: readonly {
      readonly name: string;
      readonly total: number;
      readonly completed: number;
      readonly rate: number;
    }[],
    locale: SupportedLocale,
  ): string {
    if (rates.length === 0) return suggestionContextTranslations[locale].none;
    return rates.map((r) => `${r.name}:${r.rate}%`).join("|");
  }

  #formatStreak(
    info: { readonly currentStreak: number; readonly longestStreak: number } | null,
    locale: SupportedLocale,
  ): string {
    if (info === null) return suggestionContextTranslations[locale].noStreak;
    return suggestionContextTranslations[locale].streak(info.currentStreak, info.longestStreak);
  }

  #formatCurrentDate(date: dayjs.Dayjs, timezone: string, locale: SupportedLocale): string {
    const local = date.tz(timezone);
    return suggestionContextTranslations[locale].currentDate(
      local.format("YYYY-MM-DD"),
      dayIndexToDayOfWeek(local.day()),
      local.month() + 1,
      local.date(),
    );
  }
}
