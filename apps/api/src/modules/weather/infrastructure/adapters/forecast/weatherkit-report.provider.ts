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
import {
  WeatherKitNotConfiguredError,
  WeatherKitTokenResolver,
} from "./weatherkit-token.resolver.js";
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

/** 사용자 요청 경로라 모듈 공용 10초보다 짧게 끊고 폴백으로 넘긴다. */
const WEATHER_TIMEOUT_MS = 4_000;
const AVAILABILITY_TIMEOUT_MS = 3_000;
const AUTH_REJECTED_STATUSES: readonly number[] = [401, 403];

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;
/** 응답 24시간·10일에 최신 폴백(6시간)과 자정 경계 여유를 더해 받는다. */
const HOURLY_RANGE_MS = 30 * HOUR_MS;
const DAILY_RANGE_MS = 11 * DAY_MS;
const COORDINATE_DECIMALS = 4;

type WeatherKitFailureReason =
  | "http_failure"
  | "auth_rejected"
  | "invalid_structure"
  | "missing_current"
  | "recent_failure";

/** 429·5xx·인증 거절·형식 오류 모두 호출자에게는 같은 공급자 실패이며 폴백 대상이다. */
export class WeatherKitRequestError extends Error {
  constructor(
    readonly reason: WeatherKitFailureReason,
    readonly status: number | null = null,
  ) {
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

function statusOf(error: unknown): number | null {
  return error instanceof WeatherKitRequestError ? error.status : null;
}

@Injectable()
export class WeatherKitReportProvider implements WeatherReportProviderPort {
  readonly #logger = new Logger(WeatherKitReportProvider.name);

  constructor(
    @InjectHttpClient("weather") private readonly http: HttpClient,
    @Inject(WeatherKitTokenResolver)
    private readonly tokenResolver: Pick<WeatherKitTokenResolver, "resolve" | "invalidate">,
    @Inject(CacheService)
    private readonly cacheService: Pick<CacheService, "wrap" | "has" | "set">,
  ) {}

  async getReport(cell: GeoCell, request: WeatherReportRequest): Promise<WeatherReport> {
    const failureKey = WeatherReportCacheKey.providerFailure(cell.key);
    // 장애 중에는 요청마다 시간 초과를 기다리지 않고 바로 폴백하도록 칸별로 잠시 호출을 멈춘다.
    if (await this.cacheService.has(failureKey)) {
      this.#logger.debug({ event: WeatherKitLogEvent.REQUEST_SKIPPED, cellKey: cell.key });
      throw new WeatherKitRequestError("recent_failure");
    }

    const startedAtMs = performance.now();
    try {
      const requestedAt = now();
      const dataSets = await this.#availableDataSets(cell, request);
      const weather = await this.#fetchWeather(cell, request, dataSets, requestedAt);
      const received = receivedDataSets(weather);
      const dropped = dataSets.filter((dataSet) => !received.includes(dataSet));
      if (dropped.length > 0) {
        this.#logger.warn({
          event: WeatherKitLogEvent.DATASET_DROPPED,
          cellKey: cell.key,
          dataSets: dropped,
        });
      }
      const { currentWeather } = weather;
      if (currentWeather == null) {
        throw new WeatherKitRequestError("missing_current", 200);
      }

      this.#logger.log({
        event: WeatherKitLogEvent.REQUEST_COMPLETED,
        cellKey: cell.key,
        status: 200,
        latencyMs: Math.round(performance.now() - startedAtMs),
        dataSets: received,
      });
      return toWeatherReport({ ...weather, currentWeather }, request.timezone, requestedAt);
    } catch (error) {
      this.#logger.warn({
        event: WeatherKitLogEvent.REQUEST_FAILED,
        cellKey: cell.key,
        status: statusOf(error),
        latencyMs: Math.round(performance.now() - startedAtMs),
        errorType: errorTypeOf(error),
      });
      if (!(error instanceof WeatherKitNotConfiguredError)) {
        await this.cacheService.set(failureKey, true, WEATHER_REPORT_CACHE_TTL_MS.PROVIDER_FAILURE);
      }
      throw error;
    }
  }

  /** 거절된 토큰은 한 번만 새로 서명해 다시 보낸다. 두 번째 거절은 그대로 실패한다. */
  async #fetchWeather(
    cell: GeoCell,
    request: WeatherReportRequest,
    dataSets: readonly WeatherKitDataSet[],
    requestedAt: Date,
  ): Promise<WeatherKitWeather> {
    const hourlyStart = new Date(Math.floor(requestedAt.getTime() / HOUR_MS) * HOUR_MS);
    const send = async () =>
      requestVendorJson(
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
        {
          headers: { authorization: `Bearer ${await this.tokenResolver.resolve()}` },
          signal: request.signal,
          timeoutMs: WEATHER_TIMEOUT_MS,
        },
      );

    let outcome = await send();
    if (outcome.kind === "http_failure" && AUTH_REJECTED_STATUSES.includes(outcome.statusCode)) {
      this.tokenResolver.invalidate();
      outcome = await send();
    }
    if (outcome.kind === "http_failure") {
      const reason = AUTH_REJECTED_STATUSES.includes(outcome.statusCode)
        ? "auth_rejected"
        : "http_failure";
      throw new WeatherKitRequestError(reason, outcome.statusCode);
    }

    const parsed = weatherKitWeatherSchema.safeParse(outcome.body);
    if (!parsed.success) {
      throw new WeatherKitRequestError("invalid_structure", 200);
    }
    return parsed.data;
  }

  /**
   * 지역마다 제공 dataset이 다르고(한국은 분 단위 예보·특보 없음) 없는 dataset을 요청하면 실패하므로
   * 칸별 가용성을 7일 캐시한다. 조회 실패는 캐시하지 않고 기본 dataset으로 진행한다.
   */
  async #availableDataSets(
    cell: GeoCell,
    request: WeatherReportRequest,
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
            {
              headers: { authorization: `Bearer ${await this.tokenResolver.resolve()}` },
              signal: request.signal,
              timeoutMs: AVAILABILITY_TIMEOUT_MS,
            },
          );
          if (outcome.kind === "http_failure") {
            throw new WeatherKitRequestError("http_failure", outcome.statusCode);
          }
          const parsed = availabilitySchema.safeParse(outcome.body);
          if (!parsed.success || !parsed.data.includes("currentWeather")) {
            throw new WeatherKitRequestError("invalid_structure", 200);
          }
          return parsed.data;
        },
        WEATHER_REPORT_CACHE_TTL_MS.AVAILABILITY,
      );
    } catch (error) {
      if (error instanceof WeatherKitNotConfiguredError) {
        throw error;
      }
      this.#logger.warn({
        event: WeatherKitLogEvent.AVAILABILITY_FAILED,
        cellKey: cell.key,
        status: statusOf(error),
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
