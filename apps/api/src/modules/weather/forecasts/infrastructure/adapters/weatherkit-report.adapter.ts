import { Inject, Injectable, Logger } from "@nestjs/common";
import { HttpClient, InjectHttpClient } from "@nestjs/http-client";
import { round } from "es-toolkit";
import { z } from "zod";

import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import { requestVendorJson } from "#api/platform/http/request-vendor-json";
import type { OutboundPolicy } from "#api/platform/resilience/outbound-policy";
import { OutboundRejectedError } from "#api/platform/resilience/outbound-policy.errors";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { toIsoString } from "#api/shared/domain/time/instant";

import type { GeoCell } from "../../../shared/domain/geo-cell.vo.js";
import type {
  WeatherReportProviderPort,
  WeatherReportRequest,
} from "../../application/ports/weather-report-provider.port.js";
import type { WeatherReportAttribution } from "../../application/read-models/weather-report-attribution.read-model.js";
import type { WeatherReportLanguage } from "../../domain/weather-report-language.domain-service.js";
import type { WeatherReport } from "../../domain/weather-report.vo.js";
import {
  WEATHER_REPORT_CACHE_TTL_MS,
  WeatherReportCacheKey,
} from "../cache/weather-report.keyspace.js";
import { WeatherKitLogEvent } from "../weatherkit.log-events.js";
import { WEATHERKIT_POLICY } from "./weather-outbound.policy.js";
import { WeatherKitAttributionAdapter } from "./weatherkit-attribution.adapter.js";
import { toWeatherReport } from "./weatherkit-report.mapper.js";
import {
  WeatherKitNotConfiguredError,
  WeatherKitTokenAdapter,
} from "./weatherkit-token.adapter.js";
import { WeatherKitUsageMeterAdapter } from "./weatherkit-usage-meter.adapter.js";
import { type WeatherKitWeather, weatherKitWeatherSchema } from "./weatherkit.wire.js";

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
const WEATHER_TIMEOUT_MS = 4000;
const AVAILABILITY_TIMEOUT_MS = 3000;
const AUTH_REJECTED_STATUSES: readonly number[] = [401, 403];

const MS_PER_HOUR = 60 * 60_000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
/** 응답 24시간·10일에 최신 폴백(6시간)과 자정 경계 여유를 더해 받는다. */
const HOURLY_RANGE_MS = 30 * MS_PER_HOUR;
const DAILY_RANGE_MS = 11 * MS_PER_DAY;
const COORDINATE_DECIMALS = 4;

type WeatherKitFailureReason =
  | "http_failure"
  | "auth_rejected"
  | "invalid_structure"
  | "missing_current"
  | "recent_failure"
  | "provider_outage"
  | "provider_busy";

/** 429·5xx·인증 거절·형식 오류 모두 호출자에게는 같은 공급자 실패이며 폴백 대상이다. */
export class WeatherKitRequestError extends Error {
  readonly reason: WeatherKitFailureReason;
  readonly status: number | null;

  constructor(reason: WeatherKitFailureReason, status: number | null = null) {
    super(`WeatherKit request failed: ${reason}`);
    this.name = "WeatherKitRequestError";
    this.reason = reason;
    this.status = status;
  }
}

function receivedDataSets(weather: WeatherKitWeather): WeatherKitDataSet[] {
  return DATA_SETS.filter((dataSet) => weather[dataSet] != null);
}

function failureTypeOf(error: unknown): string {
  return error instanceof WeatherKitRequestError ? error.reason : toErrorType(error);
}

/** 회로가 열렸거나 동시 호출이 가득 차 부르지 않은 실패. 칸 문제가 아니라 칸별 차단을 걸지 않는다. */
function toRejection(error: OutboundRejectedError): WeatherKitRequestError {
  return new WeatherKitRequestError(
    error.reason === "circuit-open" ? "provider_outage" : "provider_busy",
  );
}

function isRejection(error: unknown): boolean {
  return (
    error instanceof WeatherKitRequestError &&
    (error.reason === "provider_outage" || error.reason === "provider_busy")
  );
}

function statusOf(error: unknown): number | null {
  return error instanceof WeatherKitRequestError ? error.status : null;
}

@Injectable()
export class WeatherKitReportAdapter implements WeatherReportProviderPort {
  readonly #logger = new Logger(WeatherKitReportAdapter.name);
  readonly #policy: OutboundPolicy;
  readonly #http: HttpClient;
  readonly #tokenResolver: Pick<WeatherKitTokenAdapter, "resolve" | "invalidate">;
  readonly #cache: Pick<CacheStorePort, "wrap" | "has" | "set">;
  readonly #attributionResolver: Pick<WeatherKitAttributionAdapter, "resolve">;
  readonly #usage: Pick<WeatherKitUsageMeterAdapter, "recordCall">;
  readonly #clock: ClockPort;

  constructor(
    @InjectHttpClient("weather") http: HttpClient,
    @Inject(WeatherKitTokenAdapter)
    tokenResolver: Pick<WeatherKitTokenAdapter, "resolve" | "invalidate">,
    @Inject(CacheStorePort)
    cache: Pick<CacheStorePort, "wrap" | "has" | "set">,
    @Inject(WeatherKitAttributionAdapter)
    attributionResolver: Pick<WeatherKitAttributionAdapter, "resolve">,
    policies: OutboundPolicyRegistry,
    @Inject(WeatherKitUsageMeterAdapter) usage: Pick<WeatherKitUsageMeterAdapter, "recordCall">,
    clock: ClockPort,
  ) {
    this.#clock = clock;
    this.#http = http;
    this.#tokenResolver = tokenResolver;
    this.#cache = cache;
    this.#attributionResolver = attributionResolver;
    this.#usage = usage;
    this.#policy = policies.get(WEATHERKIT_POLICY);
  }

  async getReport(cell: GeoCell, request: WeatherReportRequest): Promise<WeatherReport> {
    // 공급자 전체 장애 중에는 칸마다 시간 초과를 기다리지 않고 같은 실패로 바로 폴백한다.
    if (this.#policy.isOpen()) {
      this.#logger.debug({
        event: WeatherKitLogEvent.REQUEST_SKIPPED,
        cellKey: cell.key,
        reason: "provider_outage",
      });
      throw new WeatherKitRequestError("provider_outage");
    }
    const failureKey = WeatherReportCacheKey.providerFailure(cell.key);
    // 장애 중에는 요청마다 시간 초과를 기다리지 않고 바로 폴백하도록 칸별로 잠시 호출을 멈춘다.
    if (await this.#cache.has(failureKey)) {
      this.#logger.debug({ event: WeatherKitLogEvent.REQUEST_SKIPPED, cellKey: cell.key });
      throw new WeatherKitRequestError("recent_failure");
    }

    const startedAtMs = performance.now();
    try {
      const requestedAt = this.#clock.now();
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
    } catch (cause) {
      const error = cause instanceof OutboundRejectedError ? toRejection(cause) : cause;
      this.#logger.warn({
        event: WeatherKitLogEvent.REQUEST_FAILED,
        cellKey: cell.key,
        status: statusOf(error),
        latencyMs: Math.round(performance.now() - startedAtMs),
        errorType: failureTypeOf(error),
      });
      if (!(error instanceof WeatherKitNotConfiguredError) && !isRejection(error)) {
        await this.#cache.set(failureKey, true, WEATHER_REPORT_CACHE_TTL_MS.PROVIDER_FAILURE);
      }
      throw error;
    }
  }

  /** 특보 제목만 요청 언어로 번역된다. 가용성 조회(7일 캐시)가 실패하면 특보를 요청하지 않으므로 false다. */
  async localizesContent(cell: GeoCell, request: WeatherReportRequest): Promise<boolean> {
    const dataSets = await this.#availableDataSets(cell, request);
    return dataSets.includes("weatherAlerts");
  }

  getAttribution(language: WeatherReportLanguage): Promise<WeatherReportAttribution> {
    return this.#attributionResolver.resolve(language);
  }

  /** 거절된 토큰은 한 번만 새로 서명해 다시 보낸다. 두 번째 거절은 그대로 실패한다. */
  async #fetchWeather(
    cell: GeoCell,
    request: WeatherReportRequest,
    dataSets: readonly WeatherKitDataSet[],
    requestedAt: Temporal.Instant,
  ): Promise<WeatherKitWeather> {
    const hourlyStart = Temporal.Instant.fromEpochMilliseconds(
      Math.floor(requestedAt.epochMilliseconds / MS_PER_HOUR) * MS_PER_HOUR,
    );
    const send = async () => {
      const authorization = `Bearer ${await this.#tokenResolver.resolve()}`;
      return this.#call(
        (signal) =>
          requestVendorJson(
            this.#http,
            this.#cellUrl("weather", cell, request.language),
            {
              dataSets: dataSets.join(","),
              timezone: request.timezone,
              countryCode: request.countryCode,
              hourlyStart: toIsoString(hourlyStart),
              hourlyEnd: toIsoString(hourlyStart.add({ milliseconds: HOURLY_RANGE_MS })),
              dailyEnd: toIsoString(requestedAt.add({ milliseconds: DAILY_RANGE_MS })),
            },
            { headers: { authorization }, signal, timeoutMs: WEATHER_TIMEOUT_MS },
          ),
        request.signal,
      );
    };

    let outcome = await send();
    if (outcome.kind === "http_failure" && AUTH_REJECTED_STATUSES.includes(outcome.statusCode)) {
      this.#tokenResolver.invalidate();
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
   * 칸별 가용성을 7일 캐시한다. 조회가 실패하면 기본 dataset으로 진행하고, Apple 장애 동안 요청마다
   * 3초를 기다리지 않도록 그 칸의 가용성 조회를 1분 멈춘다. 회로가 열린 동안에는 캐시에 없는 칸만 기본 dataset으로 둔다.
   */
  async #availableDataSets(
    cell: GeoCell,
    request: WeatherReportRequest,
  ): Promise<readonly WeatherKitDataSet[]> {
    const failureKey = WeatherReportCacheKey.availabilityFailure(cell.key);
    if (await this.#cache.has(failureKey)) {
      return BASE_DATA_SETS;
    }
    try {
      return await this.#cache.wrap(
        WeatherReportCacheKey.availability(cell.key),
        cachedAvailabilitySchema,
        async () => {
          const authorization = `Bearer ${await this.#tokenResolver.resolve()}`;
          const outcome = await this.#call(
            (signal) =>
              requestVendorJson(
                this.#http,
                this.#cellUrl("availability", cell),
                { country: request.countryCode },
                { headers: { authorization }, signal, timeoutMs: AVAILABILITY_TIMEOUT_MS },
              ),
            request.signal,
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
      if (error instanceof OutboundRejectedError) {
        return BASE_DATA_SETS;
      }
      this.#logger.warn({
        event: WeatherKitLogEvent.AVAILABILITY_FAILED,
        cellKey: cell.key,
        status: statusOf(error),
        errorType: failureTypeOf(error),
      });
      await this.#cache.set(failureKey, true, WEATHER_REPORT_CACHE_TTL_MS.AVAILABILITY_FAILURE);
      return BASE_DATA_SETS;
    }
  }

  /** 공용 회로·동시성 정책 안에서 한 번 부르고 실제로 보낸 호출을 월 사용량에 센다. */
  #call<T>(send: (signal: AbortSignal) => Promise<T>, signal: AbortSignal | undefined): Promise<T> {
    return this.#policy.execute(async (inner) => {
      await this.#usage.recordCall();
      return send(inner);
    }, signal);
  }

  /** 사용자 좌표 대신 칸 중심만 공급자에 보낸다. */
  #cellUrl(resource: "weather" | "availability", cell: GeoCell, language?: string): string {
    const { latitude, longitude } = cell.center;
    return [
      WEATHERKIT_API_URL,
      resource,
      ...(language == null ? [] : [encodeURIComponent(language)]),
      round(latitude, COORDINATE_DECIMALS),
      round(longitude, COORDINATE_DECIMALS),
    ].join("/");
  }
}
