import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { dayWindowInTimezone } from "#api/shared/domain/date/utils/timezone";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate, instantToDate } from "#api/shared/domain/time/instant";

import { userLocationNotFound } from "../../../locations/application/locations.errors.js";
import type { TimezoneResolverPort } from "../../../locations/application/ports/timezone-resolver.port.js";
import type { UserLocationRepositoryPort } from "../../../locations/application/ports/user-location.repository.port.js";
import { GeoCell } from "../../../shared/domain/geo-cell.vo.js";
import { isKoreanWeatherCovered } from "../../../shared/domain/korean-weather-coverage.domain-service.js";
import {
  planWeatherBriefing,
  type WeatherBriefing,
  type WeatherBriefingTodo,
} from "../../domain/weather-briefing.domain-service.js";
import type { WeatherReportLanguage } from "../../domain/weather-report-language.domain-service.js";
import { windowWeatherReport } from "../../domain/weather-report-window.domain-service.js";
import {
  type WeatherReport,
  type WeatherReportAttribution,
} from "../../domain/weather-report.vo.js";
import { ForecastLogEvent } from "../forecasts.log-events.js";
import type { AirQuality, AirQualityProviderPort } from "../ports/air-quality-provider.port.js";
import type { ScheduledTodoReaderPort } from "../ports/scheduled-todo.reader.port.js";
import type { WeatherReportCachePort } from "../ports/weather-report-cache.port.js";
import type { WeatherReportProviderPort } from "../ports/weather-report-provider.port.js";
import type { WeatherReportReaderPort } from "../ports/weather-report.reader.port.js";

const KOREA_COUNTRY_CODE = "KR";

export interface GetWeatherReportQuery {
  readonly userId: string;
  readonly language: WeatherReportLanguage;
  /** 할 일을 저장한 기기 시간대(`X-Timezone`). 없으면 위치 시간대로 오늘을 정한다. */
  readonly timezone?: string;
}

export interface WeatherReportResult {
  readonly location: {
    readonly latitude: number;
    readonly longitude: number;
    readonly timezone: string;
  };
  readonly report: WeatherReport;
  readonly airQuality: AirQuality | null;
  readonly attribution: WeatherReportAttribution;
  /** 오늘 할 일 조회가 실패하면 브리핑만 빠진다. */
  readonly briefing: WeatherBriefing | null;
}

export interface GetWeatherReportDependencies {
  readonly userLocationRepository: Pick<UserLocationRepositoryPort, "findByUserId">;
  readonly weatherReportReader: Pick<WeatherReportReaderPort, "readReport">;
  readonly weatherReportProvider: Pick<WeatherReportProviderPort, "getAttribution">;
  readonly weatherReportCache: Pick<WeatherReportCachePort, "getOrLoadAirQuality">;
  readonly timezoneResolver: Pick<TimezoneResolverPort, "resolve">;
  readonly airQualityProvider: Pick<AirQualityProviderPort, "getAirQuality">;
  readonly scheduledTodoReader: Pick<ScheduledTodoReaderPort, "listPendingTimedTodos">;
  readonly logger: Pick<ApplicationLoggerPort, "warn" | "error">;
  readonly clock: ClockPort;
}

export class GetWeatherReportUseCase {
  readonly #dependencies: GetWeatherReportDependencies;

  constructor(dependencies: GetWeatherReportDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetWeatherReportQuery): Promise<WeatherReportResult> {
    const location = await this.#dependencies.userLocationRepository.findByUserId(
      UserId.reconstitute(query.userId),
    );
    if (location == null) {
      throw userLocationNotFound();
    }

    const cell = GeoCell.create(location.coordinate);
    // 리포트·대기질 캐시를 칸 단위로 공유하므로 시간대·국가·대기질 여부도 사용자 좌표가 아닌 칸 중심에서 정한다.
    const region = this.#dependencies.timezoneResolver.resolve(cell.center);
    const isKorea =
      region.countryCode === KOREA_COUNTRY_CODE && isKoreanWeatherCovered(cell.center);

    const now = this.#dependencies.clock.now();
    const nowDate = instantToDate(now);
    const timezone = query.timezone ?? region.timezone;

    // 리포트는 언어 공유 캐시일 수 있으므로 공급자 표기는 요청 언어로 따로 받는다.
    const [reportResult, airQualityResult, attributionResult, todosResult] =
      await Promise.allSettled([
        this.#dependencies.weatherReportReader.readReport(cell, region, query.language),
        isKorea ? this.#loadAirQuality(cell) : Promise.resolve(null),
        this.#dependencies.weatherReportProvider.getAttribution(query.language),
        this.#listTodayTodos(UserId.reconstitute(query.userId), now, timezone),
      ]);
    if (reportResult.status === "rejected") {
      throw reportResult.reason;
    }
    if (attributionResult.status === "rejected") {
      throw attributionResult.reason;
    }
    if (airQualityResult.status === "rejected") {
      this.#dependencies.logger.warn({
        event: ForecastLogEvent.REPORT_AIR_QUALITY_UNAVAILABLE,
        cellKey: cell.key,
        errorType: toErrorType(airQualityResult.reason),
      });
    }

    if (todosResult.status === "rejected") {
      this.#dependencies.logger.warn({
        event: ForecastLogEvent.REPORT_BRIEFING_TODOS_UNAVAILABLE,
        errorType: toErrorType(todosResult.reason),
      });
    }

    const report = windowWeatherReport(reportResult.value, nowDate, region.timezone);
    return {
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        timezone: region.timezone,
      },
      report,
      airQuality: airQualityResult.status === "fulfilled" ? airQualityResult.value : null,
      attribution: attributionResult.value,
      briefing:
        todosResult.status === "fulfilled"
          ? planWeatherBriefing({
              hourly: report.hourly,
              todos: todosResult.value,
              now: nowDate,
              timezone,
            })
          : null,
    };
  }

  /** 지금부터 기기 시간대의 오늘이 끝날 때까지 남은, 시각이 정해진 할 일 */
  async #listTodayTodos(
    userId: UserId,
    now: Temporal.Instant,
    timezone: string,
  ): Promise<WeatherBriefingTodo[]> {
    const today = dayWindowInTimezone(instantToDate(now), timezone);
    const todos = await this.#dependencies.scheduledTodoReader.listPendingTimedTodos({
      userId,
      date: Temporal.PlainDate.from(today.localDate),
      timezone,
      from: now,
      until: instantFromDate(today.endsAt),
    });
    return todos.map((todo) => ({ id: todo.id, scheduledAt: instantToDate(todo.scheduledAt) }));
  }

  #loadAirQuality(cell: GeoCell): Promise<AirQuality | null> {
    const { latitude, longitude } = cell.center;
    return this.#dependencies.weatherReportCache.getOrLoadAirQuality(cell, () =>
      this.#dependencies.airQualityProvider.getAirQuality(latitude, longitude),
    );
  }
}
