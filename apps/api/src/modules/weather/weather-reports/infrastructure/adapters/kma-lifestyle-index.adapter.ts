import { Inject, Injectable, Logger } from "@nestjs/common";
import { HttpClient, InjectHttpClient } from "@nestjs/http-client";

import { requestVendorJson } from "#api/platform/http/request-vendor-json";
import type { OutboundPolicy } from "#api/platform/resilience/outbound-policy";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";

import type {
  LifestyleIndex,
  LifestyleIndexProviderPort,
  LifestyleIndexQuery,
} from "../../application/ports/lifestyle-index-provider.port.js";
import {
  weatherWeatherReportsConfig,
  type WeatherWeatherReportsConfig,
} from "../../weather-weather-reports.config.js";
import { kmaLifestyleAreaCodeAt } from "./kma-lifestyle-area.constants.js";
import { kmaUvIndexSchema } from "./kma-lifestyle.wire.js";
import { KMA_TIMEZONE } from "./kma.constants.js";
import { KMA_LIFESTYLE_POLICY } from "./weather-outbound.policy.js";
import { WeatherProviderLogEvent } from "./weather-provider.log-events.js";

@Injectable()
export class KmaLifestyleIndexAdapter implements LifestyleIndexProviderPort {
  readonly #logger = new Logger(KmaLifestyleIndexAdapter.name);

  readonly #policy: OutboundPolicy;

  readonly #config: WeatherWeatherReportsConfig;
  readonly #http: HttpClient;

  constructor(
    @Inject(weatherWeatherReportsConfig.KEY) config: WeatherWeatherReportsConfig,
    @InjectHttpClient("weather") http: HttpClient,
    policies: OutboundPolicyRegistry,
  ) {
    this.#config = config;
    this.#http = http;

    this.#policy = policies.get(KMA_LIFESTYLE_POLICY);
  }

  async getIndex(query: LifestyleIndexQuery): Promise<LifestyleIndex> {
    const feelsLikeTemperature = this.#calculateFeelsLikeTemperature(
      query.currentTemp,
      query.windSpeed,
    );

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
      const uvIndex = await this.#fetchUvIndex(apiKey, query);
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
    { lat, lon, at }: Pick<LifestyleIndexQuery, "lat" | "lon" | "at">,
  ): Promise<number | null> {
    const local = at.toZonedDateTimeISO(KMA_TIMEZONE);
    const localDate = local.toPlainDate().toString().replaceAll("-", "");
    const time = `${localDate}${String(local.hour).padStart(2, "0")}`;

    const outcome = await this.#policy.execute((signal) =>
      requestVendorJson(this.#http, {
        url: "https://apis.data.go.kr/1360000/LivingWthrIdxServiceV4/getUVIdxV4",
        query: {
          serviceKey: apiKey,
          numOfRows: 10,
          dataType: "JSON",
          areaNo: kmaLifestyleAreaCodeAt(lat, lon),
          time,
        },
        signal,
      }),
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
    return this.#readUvIndex(outcome.body);
  }

  #readUvIndex(body: unknown): number | null {
    const parsedResponse = kmaUvIndexSchema.safeParse(body);
    if (!parsedResponse.success) {
      return this.#unavailable("invalid_structure");
    }
    const data = parsedResponse.data;

    const resultCode = data.response?.header?.resultCode;
    if (resultCode !== "00") {
      return this.#unavailable("provider_result");
    }

    const items = data.response?.body?.items?.item;
    if (!items || items.length === 0) {
      return this.#unavailable("missing_item");
    }

    const firstItem = items[0];
    if (!firstItem) {
      return null;
    }

    const h0Value = firstItem.h0;
    if (h0Value == null || h0Value === "") {
      return this.#unavailable("missing_value");
    }

    const parsed = Number(h0Value);
    if (Number.isNaN(parsed)) {
      return this.#unavailable("invalid_value");
    }

    return parsed;
  }

  #unavailable(errorType: string): null {
    this.#logger.warn({
      event: WeatherProviderLogEvent.RESPONSE_UNAVAILABLE,
      provider: "kma_lifestyle",
      operation: "uv_index",
      errorType,
    });
    return null;
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
