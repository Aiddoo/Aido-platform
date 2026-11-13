import { AI_SUGGESTION_LIMITS, type DayOfWeek, dayIndexToDayOfWeek } from "@aido/api/vocabulary";

import type { WeatherForecastReaderPort } from "#api/modules/weather/forecasts/weather-forecasts.public";
import { type GridInput } from "#api/modules/weather/forecasts/weather-forecasts.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import type { SupportedLocale } from "#api/shared/domain/locale";
import { instantToDate } from "#api/shared/domain/time/instant";

import type { LatestReportStatsReaderPort } from "../../reports/application/ports/latest-report-stats.reader.port.js";
import {
  localDateAt,
  sundayBasedDayIndex,
} from "../../shared/domain/user-calendar.domain-service.js";
import { collectRecordedActivities } from "../domain/recorded-activity-evidence.domain-service.js";
import type {
  SuggestionHistoryItem,
  TodoSummaryForAnalysis,
} from "../domain/suggestion.constants.js";
import { AiSuggestionLogEvent } from "./ai-suggestion.log-events.js";
import { suggestionContextTranslations } from "./messages/suggestion-context.messages.js";
import type { SuggestionActivityReaderPort } from "./ports/suggestion-activity.reader.port.js";
import type { SuggestionContext } from "./read-models/suggestion-context.read-model.js";

/**
 * AI 제안 생성을 위한 컨텍스트 수집 및 포맷 서비스
 *
 * 통계 분석을 서버에서 수행하여 AI에게 사전 계산된 인사이트를 제공합니다.
 */
interface SuggestionContextBuilderDependencies {
  readonly activityReader: Pick<
    SuggestionActivityReaderPort,
    | "findRecentTodos"
    | "findDayCompletionRates"
    | "findTimeCompletionRates"
    | "findCategoryCompletionRates"
    | "findUserStreakInfo"
    | "findRecentResponded"
  >;
  readonly weatherForecastReader: Pick<WeatherForecastReaderPort, "readForecasts">;
  readonly latestReportStats: Pick<LatestReportStatsReaderPort, "findLatestWeekly">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "debug">;
}

export class SuggestionContextReader {
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
    const now = this.#dependencies.clock.now();
    // UTC 일수라 일광 절약 없이 24시간 단위다
    const daysAgo = (days: number) => instantToDate(now.subtract({ hours: 24 * days }));
    const analysisFrom = daysAgo(7 * AI_SUGGESTION_LIMITS.ANALYSIS_WEEKS);
    const contextFrom = daysAgo(7 * AI_SUGGESTION_LIMITS.CONTEXT_WEEKS);
    const to = instantToDate(now);

    const historySince = daysAgo(30);
    const owner = UserId.reconstitute(userId);

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
      this.#dependencies.activityReader.findRecentTodos(owner, analysisFrom, to, timezone),
      this.#dependencies.activityReader.findDayCompletionRates(owner, contextFrom, to, timezone),
      this.#dependencies.activityReader.findTimeCompletionRates(owner, contextFrom, to, timezone),
      this.#dependencies.activityReader.findCategoryCompletionRates(
        owner,
        contextFrom,
        to,
        timezone,
      ),
      this.#dependencies.activityReader.findUserStreakInfo(owner),
      this.#fetchWeatherByGrid(weatherGrid, now, locale),
      this.#dependencies.latestReportStats.findLatestWeekly(owner),
      this.#dependencies.activityReader.findRecentResponded(owner, historySince),
    ]);

    const missingRoutines = this.detectMissingRoutines(todos, timezone, locale);

    // 보고서 인사이트 추출
    let weeklyReportInsight: string | null = null;
    if (weeklyReport != null) {
      weeklyReportInsight = suggestionContextTranslations[locale].reportInsight(
        weeklyReport.completionRate,
        weeklyReport.streakDays,
      );
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
      currentDate: this.#formatCurrentDate(now, timezone, locale),
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
    const today = localDateAt(this.#dependencies.clock.now(), timezone);
    const weekStart = today.subtract({ days: today.dayOfWeek - 1 });

    // 제목+요일별 등장 횟수 집계 (이번 주 제외)
    const titleDayCount = new Map<string, Map<DayOfWeek, number>>();
    const thisWeekTitles = new Set<string>();

    for (const todo of todos) {
      const todoDate = Temporal.PlainDate.from(todo.startDate);
      const dayName = dayIndexToDayOfWeek(sundayBasedDayIndex(todoDate));

      if (Temporal.PlainDate.compare(todoDate, weekStart) >= 0) {
        thisWeekTitles.add(todo.title);
        continue;
      }

      if (!titleDayCount.has(todo.title)) {
        titleDayCount.set(todo.title, new Map());
      }
      const dayMap = titleDayCount.get(todo.title);
      if (dayMap == null) {
        continue;
      }
      dayMap.set(dayName, (dayMap.get(dayName) ?? 0) + 1);
    }

    const missing: string[] = [];

    for (const [title, dayMap] of titleDayCount) {
      if (thisWeekTitles.has(title)) {
        continue;
      }

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
    target: Temporal.Instant,
    locale: SupportedLocale,
  ): Promise<string | null> {
    if (grid == null) {
      return null;
    }

    try {
      const forecasts = await this.#dependencies.weatherForecastReader.readForecasts({
        grids: [grid],
        target,
      });
      const forecast = forecasts.get(`${grid.gridX}:${grid.gridY}`);
      if (forecast == null) {
        return null;
      }

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
    if (rates.length === 0) {
      return suggestionContextTranslations[locale].none;
    }
    return rates.map((r) => `${r.name}:${r.rate}%`).join("|");
  }

  #formatStreak(
    info: { readonly currentStreak: number; readonly longestStreak: number } | null,
    locale: SupportedLocale,
  ): string {
    if (info == null) {
      return suggestionContextTranslations[locale].noStreak;
    }
    return suggestionContextTranslations[locale].streak(info.currentStreak, info.longestStreak);
  }

  #formatCurrentDate(now: Temporal.Instant, timezone: string, locale: SupportedLocale): string {
    const local = localDateAt(now, timezone);
    return suggestionContextTranslations[locale].currentDate(
      local.toString(),
      dayIndexToDayOfWeek(sundayBasedDayIndex(local)),
      local.month,
      local.day,
    );
  }
}
