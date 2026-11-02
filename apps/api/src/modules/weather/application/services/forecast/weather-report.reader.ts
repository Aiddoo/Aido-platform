import { ErrorCode } from "@aido/api/errors";
import { flatMapAsync, groupBy } from "es-toolkit";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { Coordinate } from "../../../domain/value-objects/forecast/coordinate.vo.js";
import { GeoCell } from "../../../domain/value-objects/forecast/geo-cell.vo.js";
import {
  SHARED_WEATHER_REPORT_SCOPE,
  type WeatherReportCacheScope,
  type WeatherReportLanguage,
} from "../../models/forecast/weather-report-language.js";
import {
  type WeatherReport,
  windowWeatherReport,
} from "../../models/forecast/weather-report.model.js";
import { WeatherLogEvent } from "../../observability/forecast/weather-log.events.js";
import type {
  ResolvedRegion,
  TimezoneResolverPort,
} from "../../ports/forecast/timezone.resolver.port.js";
import type { WeatherReportCachePort } from "../../ports/forecast/weather-report.cache.port.js";
import type {
  WeatherReportProviderPort,
  WeatherReportRequest,
} from "../../ports/forecast/weather-report.provider.port.js";
import type {
  LocatedWeatherReport,
  WeatherReportReaderPort,
  WeatherReportReadRequest,
} from "../../ports/forecast/weather-report.reader.port.js";

/** 알림처럼 같은 시각에 몰리는 호출이 공급자에 한꺼번에 몰리지 않도록 칸을 몇 개씩만 동시에 읽는다. */
const CELL_READ_CONCURRENCY = 4;

interface WeatherReportReaderDependencies {
  readonly weatherReportProvider: Pick<WeatherReportProviderPort, "getReport" | "localizesContent">;
  readonly weatherReportCache: Pick<WeatherReportCachePort, "getOrLoadReport" | "getLatestReport">;
  readonly timezoneResolver: Pick<TimezoneResolverPort, "resolve">;
  readonly logger: Pick<ApplicationLogger, "warn" | "error">;
}

/** 화면 조회와 날씨 알림이 같은 칸 캐시·폴백을 쓰도록 v2 리포트 읽기를 한곳에 둔다. */
export class WeatherReportReader implements WeatherReportReaderPort {
  readonly #dependencies: WeatherReportReaderDependencies;

  constructor(dependencies: WeatherReportReaderDependencies) {
    this.#dependencies = dependencies;
  }

  async readReport(
    cell: GeoCell,
    region: ResolvedRegion,
    language: WeatherReportLanguage,
  ): Promise<WeatherReport> {
    const request = { timezone: region.timezone, countryCode: region.countryCode, language };
    const scope = await this.#cacheScope(cell, request);
    try {
      return await this.#dependencies.weatherReportCache.getOrLoadReport(cell, scope, () =>
        this.#dependencies.weatherReportProvider.getReport(cell, request),
      );
    } catch (error) {
      // 공급자 실패의 상세(status·latency)는 adapter가 이미 기록했다. 여기서는 폴백 결과만 남긴다.
      const latest = await this.#latestReport(cell, scope, language);
      if (latest == null) {
        this.#dependencies.logger.error({
          event: WeatherLogEvent.REPORT_UNAVAILABLE,
          cellKey: cell.key,
          fallback: false,
          errorType: toErrorType(error),
          errorCode: ErrorCode.WEATHER_1901,
        });
        throw new ApplicationException(ErrorCode.WEATHER_1901);
      }
      this.#dependencies.logger.warn({
        event: WeatherLogEvent.REPORT_FALLBACK_USED,
        cellKey: cell.key,
        fallback: true,
        fetchedAt: latest.fetchedAt.toISOString(),
      });
      return latest;
    }
  }

  async readReports(
    requests: readonly WeatherReportReadRequest[],
    now: Date,
  ): Promise<ReadonlyMap<string, LocatedWeatherReport>> {
    const located = requests.map((request) => ({
      request,
      cell: GeoCell.fromCoordinate(Coordinate.of(request.latitude, request.longitude)),
    }));
    const groups = Object.values(
      groupBy(located, ({ cell, request }) => `${cell.key}\u0000${request.language}`),
    );

    const entries = await flatMapAsync(
      groups,
      async (group) => {
        const [first] = group;
        if (first == null) {
          return [];
        }
        const region = this.#dependencies.timezoneResolver.resolve(first.cell.center);
        try {
          const report = await this.readReport(first.cell, region, first.request.language);
          const value: LocatedWeatherReport = {
            timezone: region.timezone,
            report: windowWeatherReport(report, now, region.timezone),
          };
          return group.map(({ request }) => [request.key, value] as const);
        } catch (error) {
          // 공급자·캐시 실패는 readReport가 이미 남겼다. 그 밖의 실패만 여기서 남긴다.
          if (!(error instanceof ApplicationException)) {
            this.#dependencies.logger.warn({
              event: WeatherLogEvent.REPORT_READ_FAILED,
              cellKey: first.cell.key,
              errorType: toErrorType(error),
            });
          }
          return [];
        }
      },
      { concurrency: CELL_READ_CONCURRENCY },
    );
    return new Map(entries);
  }

  /**
   * 장애 중 가용성 캐시가 없으면 scope가 공유로 바뀌므로, 그 scope의 스냅샷이 없을 때 다른 scope의 스냅샷도 본다.
   * 공유 스냅샷은 특보 제목이 없을 뿐 같은 칸의 예보다.
   */
  async #latestReport(
    cell: GeoCell,
    scope: WeatherReportCacheScope,
    language: WeatherReportLanguage,
  ): Promise<WeatherReport | undefined> {
    const { weatherReportCache } = this.#dependencies;
    const otherScope =
      scope === SHARED_WEATHER_REPORT_SCOPE ? language : SHARED_WEATHER_REPORT_SCOPE;
    return (
      (await weatherReportCache.getLatestReport(cell, scope)) ??
      weatherReportCache.getLatestReport(cell, otherScope)
    );
  }

  /**
   * 번역 문구가 없는 칸은 언어별로 캐시를 나누지 않는다. 판단이 실패하면(자격 증명 미설정 등) 공유 scope로 두고
   * 같은 원인으로 실패할 본 호출이 폴백·`WEATHER_1901` 경로를 거치게 한다.
   */
  async #cacheScope(
    cell: GeoCell,
    request: WeatherReportRequest,
  ): Promise<WeatherReportCacheScope> {
    try {
      return (await this.#dependencies.weatherReportProvider.localizesContent(cell, request))
        ? request.language
        : SHARED_WEATHER_REPORT_SCOPE;
    } catch {
      return SHARED_WEATHER_REPORT_SCOPE;
    }
  }
}
