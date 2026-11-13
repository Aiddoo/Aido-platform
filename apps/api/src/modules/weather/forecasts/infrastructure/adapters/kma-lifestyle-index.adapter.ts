import { Inject, Injectable, Logger } from "@nestjs/common";
import { HttpClient, InjectHttpClient } from "@nestjs/http-client";

import { requestVendorJson } from "#api/platform/http/request-vendor-json";
import type { OutboundPolicy } from "#api/platform/resilience/outbound-policy";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";

import type {
  LifestyleIndex,
  LifestyleIndexProviderPort,
} from "../../application/ports/lifestyle-index-provider.port.js";
import {
  weatherForecastsConfig,
  type WeatherForecastsConfig,
} from "../../weather-forecasts.config.js";
import { WeatherProviderLogEvent } from "../weather-provider.log-events.js";
import { getRegionCode } from "./kma-lifestyle-area.mapper.js";
import { kmaUvIndexSchema } from "./kma-lifestyle.wire.js";
import { KMA_TIMEZONE } from "./kma.constants.js";
import { KMA_LIFESTYLE_POLICY } from "./weather-outbound.policy.js";

@Injectable()
export class KmaLifestyleIndexAdapter implements LifestyleIndexProviderPort {
  readonly #logger = new Logger(KmaLifestyleIndexAdapter.name);

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

    this.#policy = policies.get(KMA_LIFESTYLE_POLICY);
  }

  async getIndex(
    lat: number,
    lon: number,
    at: Temporal.Instant,
    currentTemp: number,
    windSpeed: number,
  ): Promise<LifestyleIndex> {
    const feelsLikeTemperature = this.#calculateFeelsLikeTemperature(currentTemp, windSpeed);

    const apiKey = this.#config.kmaApiKey;
    if (apiKey == null || apiKey === "") {
      this.#logger.warn({
        event: WeatherProviderLogEvent.NOT_CONFIGURED,
        provider: "kma_lifestyle",
        operation: "uv_index",
      });
      return { feelsLikeTemperature, uvIndex: null };
    }

    try {
      const uvIndex = await this.#fetchUvIndex(apiKey, lat, lon, at);
      return { feelsLikeTemperature, uvIndex };
    } catch (error) {
      this.#logger.warn({
        event: WeatherProviderLogEvent.REQUEST_FAILED,
        provider: "kma_lifestyle",
        operation: "uv_index",
        errorType: error instanceof Error ? "error" : "non_error",
      });
      return { feelsLikeTemperature, uvIndex: null };
    }
  }

  async #fetchUvIndex(
    apiKey: string,
    lat: number,
    lon: number,
    at: Temporal.Instant,
  ): Promise<number | null> {
    const local = at.toZonedDateTimeISO(KMA_TIMEZONE);
    const localDate = local.toPlainDate().toString().replaceAll("-", "");
    const time = `${localDate}${String(local.hour).padStart(2, "0")}`;

    const outcome = await this.#policy.execute((signal) =>
      requestVendorJson(
        this.#http,
        "https://apis.data.go.kr/1360000/LivingWthrIdxServiceV4/getUVIdxV4",
        {
          serviceKey: apiKey,
          numOfRows: 10,
          dataType: "JSON",
          areaNo: getRegionCode(lat, lon),
          time,
        },
        { signal },
      ),
    );

    if (outcome.kind === "http_failure") {
      this.#logger.warn({
        event: WeatherProviderLogEvent.HTTP_FAILED,
        provider: "kma_lifestyle",
        operation: "uv_index",
        statusCode: outcome.statusCode,
      });
      return null;
    }

    const parsedResponse = kmaUvIndexSchema.safeParse(outcome.body);
    if (!parsedResponse.success) {
      this.#logger.warn({
        event: WeatherProviderLogEvent.RESPONSE_UNAVAILABLE,
        provider: "kma_lifestyle",
        operation: "uv_index",
        errorType: "invalid_structure",
      });
      return null;
    }
    const data = parsedResponse.data;

    const resultCode = data.response?.header?.resultCode;
    if (resultCode !== "00") {
      this.#logger.warn({
        event: WeatherProviderLogEvent.RESPONSE_UNAVAILABLE,
        provider: "kma_lifestyle",
        operation: "uv_index",
        errorType: "provider_result",
      });
      return null;
    }

    const items = data.response?.body?.items?.item;
    if (!items || items.length === 0) {
      this.#logger.warn({
        event: WeatherProviderLogEvent.RESPONSE_UNAVAILABLE,
        provider: "kma_lifestyle",
        operation: "uv_index",
        errorType: "missing_item",
      });
      return null;
    }

    const firstItem = items[0];
    if (!firstItem) {
      return null;
    }

    const h0Value = firstItem.h0;
    if (h0Value == null || h0Value === "") {
      this.#logger.warn({
        event: WeatherProviderLogEvent.RESPONSE_UNAVAILABLE,
        provider: "kma_lifestyle",
        operation: "uv_index",
        errorType: "missing_value",
      });
      return null;
    }

    const parsed = Number(h0Value);
    if (Number.isNaN(parsed)) {
      this.#logger.warn({
        event: WeatherProviderLogEvent.RESPONSE_UNAVAILABLE,
        provider: "kma_lifestyle",
        operation: "uv_index",
        errorType: "invalid_value",
      });
      return null;
    }

    return parsed;
  }

  #calculateFeelsLikeTemperature(temp: number, windSpeedMs: number): number {
    // Wind Chill formula requires km/h; system windSpeed is m/s
    const windSpeedKmh = windSpeedMs * 3.6;
    if (temp <= 10 && windSpeedKmh >= 1.3) {
      const v016 = windSpeedKmh ** 0.16;
      return 13.12 + 0.6215 * temp - 11.37 * v016 + 0.3965 * temp * v016;
    }

    return temp;
  }
}
