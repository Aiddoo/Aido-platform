import { Inject, Injectable, Logger } from "@nestjs/common";
import { HttpClient, type HttpQuery, InjectHttpClient } from "@nestjs/http-client";
import { z } from "zod";

import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import { requestVendorJson } from "#api/platform/http/request-vendor-json";
import type { OutboundPolicy } from "#api/platform/resilience/outbound-policy";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import type { GeoCell } from "../../../shared/domain/geo-cell.vo.js";
import type {
  AirQuality,
  AirQualityProviderPort,
} from "../../application/ports/air-quality-provider.port.js";
import { toTmCoordinate } from "../../domain/tm-coordinate.domain-service.js";
import {
  weatherWeatherReportsConfig,
  type WeatherWeatherReportsConfig,
} from "../../weather-weather-reports.config.js";
import {
  WEATHER_REPORT_CACHE_TTL_MS,
  WeatherReportCacheKey,
} from "../cache/weather-report.keyspace.js";
import {
  type AirkoreaOperation,
  AirkoreaRequestError,
  type AirkoreaFailureReason,
} from "./airkorea.errors.js";
import {
  AIRKOREA_ANSWERED_RESULT_CODES,
  airkoreaAirQualitySchema,
  airkoreaNearbyStationSchema,
} from "./airkorea.wire.js";
import { AIRKOREA_POLICY } from "./weather-outbound.policy.js";
import { WeatherProviderLogEvent } from "./weather-provider.log-events.js";

const STATION_SCHEMA = z.string().min(1);

function parseMeasurement(value: string | null | undefined): number | null {
  if (value == null || value === "" || value === "-") {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

@Injectable()
export class AirkoreaAirQualityAdapter implements AirQualityProviderPort {
  readonly #logger = new Logger(AirkoreaAirQualityAdapter.name);
  readonly #policy: OutboundPolicy;
  readonly #config: WeatherWeatherReportsConfig;
  readonly #http: HttpClient;
  readonly #cache: Pick<CacheStorePort, "get" | "set" | "del" | "has">;

  constructor(
    @Inject(weatherWeatherReportsConfig.KEY) config: WeatherWeatherReportsConfig,
    @InjectHttpClient("weather") http: HttpClient,
    policies: OutboundPolicyRegistry,
    @Inject(CacheStorePort) cache: Pick<CacheStorePort, "get" | "set" | "del" | "has">,
  ) {
    this.#config = config;
    this.#http = http;
    this.#cache = cache;
    this.#policy = policies.get(AIRKOREA_POLICY);
  }

  /** 칸의 측정소를 30일 기억해 측정소를 아는 칸은 측정값 호출 한 번으로 끝낸다. */
  async findAirQuality(cell: GeoCell): Promise<AirQuality | null> {
    const apiKey = this.#config.kmaApiKey;
    if (apiKey == null || apiKey === "") {
      this.#logger.warn({
        event: WeatherProviderLogEvent.NOT_CONFIGURED,
        provider: "airkorea",
        operation: "air_quality",
      });
      return null;
    }
    const failureKey = WeatherReportCacheKey.airKoreaFailure(cell.key);
    // 한도 초과·키 오류 중에는 요청마다 같은 칸을 다시 부르지 않고 잠시 대기질 없이 응답한다
    if (await this.#cache.has(failureKey)) {
      throw new AirkoreaRequestError("air_quality", "recent_failure");
    }
    try {
      return await this.#findCellAirQuality(apiKey, cell);
    } catch (error) {
      await this.#cache.set(failureKey, true, WEATHER_REPORT_CACHE_TTL_MS.PROVIDER_FAILURE);
      throw error;
    }
  }

  async #findCellAirQuality(apiKey: string, cell: GeoCell): Promise<AirQuality | null> {
    const stationKey = WeatherReportCacheKey.airKoreaStation(cell.key);
    const knownStation = await this.#cache.get(stationKey, STATION_SCHEMA);
    const station = knownStation ?? (await this.#findNearestStation(apiKey, cell));
    if (station == null) {
      return null;
    }
    if (knownStation == null) {
      await this.#cache.set(stationKey, station, WEATHER_REPORT_CACHE_TTL_MS.AIRKOREA_STATION);
    }

    const airQuality = await this.#fetchAirQuality(apiKey, station);
    if (airQuality == null || (airQuality.pm10 == null && airQuality.pm25 == null)) {
      // 측정값을 주지 않는 측정소(폐쇄·이전·장비 점검)는 다음 조회가 가까운 측정소를 다시 찾게 한다
      await this.#cache.del(stationKey);
    }
    return airQuality;
  }

  async #findNearestStation(apiKey: string, cell: GeoCell): Promise<string | null> {
    const { tmX, tmY } = toTmCoordinate(cell.center);
    const body = await this.#request(
      "nearby_station",
      "https://apis.data.go.kr/B552584/MsrstnInfoInqireSvc/getNearbyMsrstnList",
      { serviceKey: apiKey, returnType: "json", tmX, tmY, ver: "1.1" },
    );
    const parsed = airkoreaNearbyStationSchema.safeParse(body);
    if (!parsed.success) {
      throw this.#failure("nearby_station", "invalid_structure");
    }
    this.#assertAnswered("nearby_station", parsed.data.response?.header?.resultCode);
    const stationName = parsed.data.response?.body?.items?.[0]?.stationName;
    if (stationName == null || stationName === "") {
      this.#logger.warn({
        event: WeatherProviderLogEvent.RESPONSE_UNAVAILABLE,
        provider: "airkorea",
        operation: "nearby_station",
        errorType: "missing_station",
      });
      return null;
    }
    return stationName;
  }

  async #fetchAirQuality(apiKey: string, stationName: string): Promise<AirQuality | null> {
    const body = await this.#request(
      "air_quality",
      "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty",
      { serviceKey: apiKey, returnType: "json", stationName, dataTerm: "DAILY", ver: "1.5" },
    );
    const parsed = airkoreaAirQualitySchema.safeParse(body);
    if (!parsed.success) {
      throw this.#failure("air_quality", "invalid_structure");
    }
    this.#assertAnswered("air_quality", parsed.data.response?.header?.resultCode);
    const latest = parsed.data.response?.body?.items?.[0];
    if (latest == null) {
      this.#logger.warn({
        event: WeatherProviderLogEvent.RESPONSE_UNAVAILABLE,
        provider: "airkorea",
        operation: "air_quality",
        errorType: "missing_item",
      });
      return null;
    }
    return {
      pm10: parseMeasurement(latest.pm10Value),
      pm25: parseMeasurement(latest.pm25Value),
    };
  }

  async #request(operation: AirkoreaOperation, url: string, query: HttpQuery): Promise<unknown> {
    const outcome = await this.#policy
      .execute((signal) => requestVendorJson(this.#http, url, query, { signal }))
      .catch((error: unknown) => {
        this.#logger.warn({
          event: WeatherProviderLogEvent.REQUEST_FAILED,
          provider: "airkorea",
          operation,
          errorType: toErrorType(error),
        });
        throw error;
      });
    if (outcome.kind === "http_failure") {
      this.#logger.warn({
        event: WeatherProviderLogEvent.HTTP_FAILED,
        provider: "airkorea",
        operation,
        statusCode: outcome.statusCode,
      });
      throw new AirkoreaRequestError(operation, "http_failure");
    }
    return outcome.body;
  }

  #assertAnswered(operation: AirkoreaOperation, resultCode: string | undefined): void {
    if (resultCode != null && !AIRKOREA_ANSWERED_RESULT_CODES.includes(resultCode)) {
      throw this.#failure(operation, "provider_result");
    }
  }

  #failure(operation: AirkoreaOperation, reason: AirkoreaFailureReason): AirkoreaRequestError {
    this.#logger.warn({
      event: WeatherProviderLogEvent.RESPONSE_UNAVAILABLE,
      provider: "airkorea",
      operation,
      errorType: reason,
    });
    return new AirkoreaRequestError(operation, reason);
  }
}
