import { flatMapAsync, groupBy } from "es-toolkit";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import type { TimezoneResolverPort } from "../../../locations/application/ports/timezone-resolver.port.js";
import { Coordinate } from "../../../shared/domain/coordinate.vo.js";
import { GeoCell } from "../../../shared/domain/geo-cell.vo.js";
import { ForecastLogEvent } from "../forecasts.log-events.js";
import type {
  LocatedWeatherReport,
  ReadWeatherReportsQuery,
  WeatherReportReaderPort,
} from "../ports/weather-report.reader.port.js";
import type { ReadWeatherReportUseCase } from "./read-weather-report.use-case.js";

/** 알림처럼 같은 시각에 몰리는 호출이 공급자에 한꺼번에 몰리지 않도록 칸을 몇 개씩만 동시에 읽는다. */
const CELL_READ_CONCURRENCY = 4;

export interface ReadWeatherReportsDependencies {
  readonly readWeatherReport: Pick<ReadWeatherReportUseCase, "execute">;
  readonly timezoneResolver: Pick<TimezoneResolverPort, "resolve">;
  readonly logger: Pick<ApplicationLoggerPort, "warn">;
}

/** 화면 조회와 날씨 알림이 같은 칸 캐시·폴백을 쓰도록 여러 위치의 리포트를 칸별로 한 번씩 읽는다. */
export class ReadWeatherReportsUseCase implements WeatherReportReaderPort {
  readonly #dependencies: ReadWeatherReportsDependencies;

  constructor(dependencies: ReadWeatherReportsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    query: ReadWeatherReportsQuery,
  ): Promise<ReadonlyMap<string, LocatedWeatherReport>> {
    const located = query.requests.map((request) => ({
      request,
      cell: GeoCell.create(Coordinate.create(request.latitude, request.longitude)),
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
          const report = await this.#dependencies.readWeatherReport.execute({
            cell: first.cell,
            region,
            language: first.request.language,
          });
          const value: LocatedWeatherReport = {
            timezone: region.timezone,
            report: report.windowAt(query.now, region.timezone),
          };
          return group.map(({ request }) => [request.key, value] as const);
        } catch (error) {
          // 공급자·캐시 실패는 ReadWeatherReportUseCase가 이미 남겼다. 그 밖의 실패만 여기서 남긴다.
          if (!(error instanceof ApplicationException)) {
            this.#dependencies.logger.warn({
              event: ForecastLogEvent.REPORT_READ_FAILED,
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
}
