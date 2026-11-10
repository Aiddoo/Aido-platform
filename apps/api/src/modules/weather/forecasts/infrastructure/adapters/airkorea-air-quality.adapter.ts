import { Inject, Injectable, Logger } from "@nestjs/common";
import { HttpClient, InjectHttpClient } from "@nestjs/http-client";

import { requestVendorJson } from "#api/platform/http/request-vendor-json";
import type { OutboundPolicy } from "#api/platform/resilience/outbound-policy";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";

import type {
  AirQuality,
  AirQualityProviderPort,
} from "../../application/ports/air-quality-provider.port.js";
import { convertToTm } from "../../domain/wgs84-to-utmk.domain-service.js";
import {
  weatherForecastsConfig,
  type WeatherForecastsConfig,
} from "../../weather-forecasts.config.js";
import { WeatherProviderLogEvent } from "../weather-provider.log-events.js";
import { airkoreaAirQualitySchema, airkoreaNearbyStationSchema } from "./airkorea.wire.js";
import { AIRKOREA_POLICY } from "./weather-outbound.policy.js";

@Injectable()
export class AirkoreaAirQualityAdapter implements AirQualityProviderPort {
  readonly #logger = new Logger(AirkoreaAirQualityAdapter.name);

  readonly #policy: OutboundPolicy;

  readonly #config: WeatherForecastsConfig;
  readonly #http: HttpClient;

  constructor(
    @Inject(weatherForecastsConfig.KEY) config: WeatherForecastsConfig,
    @InjectHttpClient("weather") http: HttpClient,
    policies: OutboundPolicyRegistry,
  ) {
    this.#config = config;
    this.#http = http;

    this.#policy = policies.get(AIRKOREA_POLICY);
  }

  async getAirQuality(lat: number, lon: number): Promise<AirQuality | null> {
    try {
      const apiKey = this.#config.kmaApiKey;
      if (apiKey == null || apiKey === "") {
        this.#logger.warn({
          event: WeatherProviderLogEvent.NOT_CONFIGURED,
          provider: "airkorea",
          operation: "air_quality",
        });
        return null;
      }

      const stationName = await this.#findNearestStation(apiKey, lat, lon);
      if (!stationName) {
        return null;
      }

      return await this.#fetchAirQuality(apiKey, stationName);
    } catch (error) {
      this.#logger.warn({
        event: WeatherProviderLogEvent.REQUEST_FAILED,
        provider: "airkorea",
        operation: "air_quality",
        errorType: error instanceof Error ? "error" : "non_error",
      });
      return null;
    }
  }

  async #findNearestStation(apiKey: string, lat: number, lon: number): Promise<string | null> {
    const { tmX, tmY } = convertToTm(lat, lon);

    const outcome = await this.#policy.execute((signal) =>
      requestVendorJson(
        this.#http,
        "https://apis.data.go.kr/B552584/MsrstnInfoInqireSvc/getNearbyMsrstnList",
        {
          serviceKey: apiKey,
          returnType: "json",
          tmX,
          tmY,
          ver: "1.1",
        },
        { signal },
      ),
    );

    if (outcome.kind === "http_failure") {
      this.#logger.warn({
        event: WeatherProviderLogEvent.HTTP_FAILED,
        provider: "airkorea",
        operation: "nearby_station",
        statusCode: outcome.statusCode,
      });
      return null;
    }

    const parsed = airkoreaNearbyStationSchema.safeParse(outcome.body);
    if (!parsed.success) {
      this.#logger.warn({
        event: WeatherProviderLogEvent.RESPONSE_UNAVAILABLE,
        provider: "airkorea",
        operation: "nearby_station",
        errorType: "invalid_structure",
      });
      return null;
    }
    const data = parsed.data;

    const items = data.response?.body?.items;
    if (!items || items.length === 0) {
      this.#logger.warn({
        event: WeatherProviderLogEvent.RESPONSE_UNAVAILABLE,
        provider: "airkorea",
        operation: "nearby_station",
        errorType: "missing_item",
      });
      return null;
    }

    const firstItem = items[0];
    if (!firstItem) {
      return null;
    }

    const stationName = firstItem.stationName;
    if (!stationName) {
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
    const outcome = await this.#policy.execute((signal) =>
      requestVendorJson(
        this.#http,
        "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty",
        {
          serviceKey: apiKey,
          returnType: "json",
          stationName,
          dataTerm: "DAILY",
          ver: "1.5",
        },
        { signal },
      ),
    );

    if (outcome.kind === "http_failure") {
      this.#logger.warn({
        event: WeatherProviderLogEvent.HTTP_FAILED,
        provider: "airkorea",
        operation: "air_quality",
        statusCode: outcome.statusCode,
      });
      return null;
    }

    const parsed = airkoreaAirQualitySchema.safeParse(outcome.body);
    if (!parsed.success) {
      this.#logger.warn({
        event: WeatherProviderLogEvent.RESPONSE_UNAVAILABLE,
        provider: "airkorea",
        operation: "air_quality",
        errorType: "invalid_structure",
      });
      return null;
    }
    const data = parsed.data;

    const items = data.response?.body?.items;
    if (!items || items.length === 0) {
      this.#logger.warn({
        event: WeatherProviderLogEvent.RESPONSE_UNAVAILABLE,
        provider: "airkorea",
        operation: "air_quality",
        errorType: "missing_item",
      });
      return null;
    }

    const firstItem = items[0];
    if (!firstItem) {
      return null;
    }

    return {
      pm10: this.#parseValue(firstItem.pm10Value),
      pm25: this.#parseValue(firstItem.pm25Value),
    };
  }

  #parseValue(value: string | null | undefined): number | null {
    if (value == null || value === "" || value === "-") {
      return null;
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return null;
    }

    return parsed;
  }
}
