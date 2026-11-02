import { Inject, Injectable, Logger } from "@nestjs/common";
import { HttpClient, InjectHttpClient } from "@nestjs/http-client";
import { z } from "zod";

import { CacheService } from "#api/platform/cache/cache.service";
import { requestVendorJson } from "#api/platform/http/request-vendor-json";
import { now } from "#api/shared/domain/date/utils/core";

import type { WeatherReport } from "../../../application/models/forecast/weather-report.model.js";
import type {
  WeatherReportProviderPort,
  WeatherReportRequest,
} from "../../../application/ports/forecast/weather-report.provider.port.js";
import type { GeoCell } from "../../../domain/value-objects/forecast/geo-cell.vo.js";
import {
  WEATHER_REPORT_CACHE_TTL_MS,
  WeatherReportCacheKey,
} from "../../cache/forecast/weather-report.keyspace.js";
import { WeatherKitLogEvent } from "../../observability/forecast/weatherkit-log.events.js";
import { toWeatherReport } from "./weatherkit-report.mapper.js";
import { WeatherKitTokenResolver } from "./weatherkit-token.resolver.js";
import { type WeatherKitWeather, weatherKitWeatherSchema } from "./weatherkit.schema.js";

const WEATHERKIT_API_URL = "https://weatherkit.apple.com/api/v1";
const DATA_SETS = [
  "currentWeather",
  "forecastNextHour",
  "forecastHourly",
  "forecastDaily",
  "weatherAlerts",
] as const;
type WeatherKitDataSet = (typeof DATA_SETS)[number];
/** 가용성 조회가 실패해도 모든 지역에서 제공되는 dataset만 요청해 본 호출이 400으로 실패하지 않게 한다. */
const BASE_DATA_SETS: readonly WeatherKitDataSet[] = [
  "currentWeather",
  "forecastHourly",
  "forecastDaily",
];
/** 모르는 dataset 이름은 버리고 알려진 것만 남긴다. */
const availabilitySchema = z
  .array(z.string())
  .transform((names) => DATA_SETS.filter((dataSet) => names.includes(dataSet)));
const cachedAvailabilitySchema = z.array(z.enum(DATA_SETS));

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;
/** 응답 24시간·10일에 최신 폴백(6시간)과 자정 경계 여유를 더해 받는다. */
const HOURLY_RANGE_MS = 30 * HOUR_MS;
const DAILY_RANGE_MS = 11 * DAY_MS;
const COORDINATE_DECIMALS = 4;

/** 429·5xx·형식 오류 모두 호출자에게는 같은 공급자 실패이며 폴백 대상이다. */
export class WeatherKitRequestError extends Error {
  constructor(readonly reason: "http_failure" | "invalid_structure" | "missing_current") {
    super(`WeatherKit request failed: ${reason}`);
    this.name = "WeatherKitRequestError";
  }
}

function roundCoordinate(value: number): number {
  const factor = 10 ** COORDINATE_DECIMALS;
  return Math.round(value * factor) / factor;
}

function receivedDataSets(weather: WeatherKitWeather): WeatherKitDataSet[] {
  return DATA_SETS.filter((dataSet) => weather[dataSet] != null);
}

function errorTypeOf(error: unknown): string {
  if (error instanceof WeatherKitRequestError) {
    return error.reason;
  }
  return error instanceof Error ? error.name : "UnknownError";
}

@Injectable()
export class WeatherKitReportProvider implements WeatherReportProviderPort {
  readonly #logger = new Logger(WeatherKitReportProvider.name);

  constructor(
    @InjectHttpClient("weather") private readonly http: HttpClient,
    @Inject(WeatherKitTokenResolver)
    private readonly tokenResolver: Pick<WeatherKitTokenResolver, "resolve">,
    @Inject(CacheService) private readonly cacheService: Pick<CacheService, "wrap">,
  ) {}

  async getReport(cell: GeoCell, request: WeatherReportRequest): Promise<WeatherReport> {
    const startedAtMs = performance.now();
    const latencyMs = () => Math.round(performance.now() - startedAtMs);
    let status: number | null = null;
    try {
      const token = await this.tokenResolver.resolve();
      const dataSets = await this.#availableDataSets(cell, request, token);
      const requestedAt = now();
      const hourlyStart = new Date(Math.floor(requestedAt.getTime() / HOUR_MS) * HOUR_MS);

      const outcome = await requestVendorJson(
        this.http,
        this.#cellUrl("weather", cell, request.language),
        {
          dataSets: dataSets.join(","),
          timezone: request.timezone,
          countryCode: request.countryCode,
          hourlyStart: hourlyStart.toISOString(),
          hourlyEnd: new Date(hourlyStart.getTime() + HOURLY_RANGE_MS).toISOString(),
          dailyEnd: new Date(requestedAt.getTime() + DAILY_RANGE_MS).toISOString(),
        },
        { headers: { authorization: `Bearer ${token}` }, signal: request.signal },
      );
      if (outcome.kind === "http_failure") {
        status = outcome.statusCode;
        throw new WeatherKitRequestError("http_failure");
      }
      status = 200;

      const parsed = weatherKitWeatherSchema.safeParse(outcome.body);
      if (!parsed.success) {
        throw new WeatherKitRequestError("invalid_structure");
      }
      const { currentWeather } = parsed.data;
      if (currentWeather == null) {
        throw new WeatherKitRequestError("missing_current");
      }

      this.#logger.log({
        event: WeatherKitLogEvent.REQUEST_COMPLETED,
        cellKey: cell.key,
        status,
        latencyMs: latencyMs(),
        dataSets: receivedDataSets(parsed.data),
      });
      return toWeatherReport({ ...parsed.data, currentWeather }, request.timezone, requestedAt);
    } catch (error) {
      this.#logger.warn({
        event: WeatherKitLogEvent.REQUEST_FAILED,
        cellKey: cell.key,
        status,
        latencyMs: latencyMs(),
        errorType: errorTypeOf(error),
      });
      throw error;
    }
  }

  /**
   * 지역마다 제공 dataset이 다르고(한국은 분 단위 예보·특보 없음) 없는 dataset을 요청하면 실패하므로
   * 칸별 가용성을 7일 캐시한다. 조회 실패는 캐시하지 않고 기본 dataset으로 진행한다.
   */
  async #availableDataSets(
    cell: GeoCell,
    request: WeatherReportRequest,
    token: string,
  ): Promise<readonly WeatherKitDataSet[]> {
    try {
      return await this.cacheService.wrap(
        WeatherReportCacheKey.availability(cell.key),
        cachedAvailabilitySchema,
        async () => {
          const outcome = await requestVendorJson(
            this.http,
            this.#cellUrl("availability", cell),
            { country: request.countryCode },
            { headers: { authorization: `Bearer ${token}` }, signal: request.signal },
          );
          if (outcome.kind === "http_failure") {
            throw new WeatherKitRequestError("http_failure");
          }
          const parsed = availabilitySchema.safeParse(outcome.body);
          if (!parsed.success || !parsed.data.includes("currentWeather")) {
            throw new WeatherKitRequestError("invalid_structure");
          }
          return parsed.data;
        },
        WEATHER_REPORT_CACHE_TTL_MS.AVAILABILITY,
      );
    } catch (error) {
      this.#logger.warn({
        event: WeatherKitLogEvent.AVAILABILITY_FAILED,
        cellKey: cell.key,
        errorType: errorTypeOf(error),
      });
      return BASE_DATA_SETS;
    }
  }

  /** 사용자 좌표 대신 칸 중심만 공급자에 보낸다. */
  #cellUrl(resource: "weather" | "availability", cell: GeoCell, language?: string): string {
    const { latitude, longitude } = cell.center;
    return [
      WEATHERKIT_API_URL,
      resource,
      ...(language == null ? [] : [encodeURIComponent(language)]),
      roundCoordinate(latitude),
      roundCoordinate(longitude),
    ].join("/");
  }
}
