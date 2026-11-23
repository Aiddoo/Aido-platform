import { Inject, Injectable, Logger } from "@nestjs/common";
import { HttpClient, InjectHttpClient } from "@nestjs/http-client";

import { requestVendorJson } from "#api/platform/http/request-vendor-json";
import type { OutboundPolicy } from "#api/platform/resilience/outbound-policy";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { TimeZone } from "#api/shared/domain/time/time-zone.vo";
import { localDateOf } from "#api/shared/domain/time/zoned-time";

import type {
  SunTime,
  SunTimeProviderPort,
} from "../../application/ports/sun-time-provider.port.js";
import {
  weatherWeatherReportsConfig,
  type WeatherWeatherReportsConfig,
} from "../../weather-weather-reports.config.js";
import { kasiSunTimeSchema } from "./kasi.wire.js";
import { KASI_POLICY } from "./weather-outbound.policy.js";
import { WeatherProviderLogEvent } from "./weather-provider.log-events.js";

@Injectable()
export class KasiSunTimeAdapter implements SunTimeProviderPort {
  readonly #logger = new Logger(KasiSunTimeAdapter.name);

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

    this.#policy = policies.get(KASI_POLICY);
  }

  async findSunTime(lat: number, lon: number, at: Temporal.Instant): Promise<SunTime | null> {
    try {
      const apiKey = this.#config.kmaApiKey;
      if (apiKey == null || apiKey === "") {
        this.#logger.warn({
          event: WeatherProviderLogEvent.NOT_CONFIGURED,
          provider: "kasi",
          operation: "sun_time",
        });
        return null;
      }

      // 천문연구원은 한국 날짜(KST)로 일출·일몰을 준다
      const locdate = localDateOf(at, TimeZone.SEOUL).toString().replaceAll("-", "");

      const outcome = await this.#policy.execute((signal) =>
        requestVendorJson(this.#http, {
          url: "https://apis.data.go.kr/B090041/openapi/service/RiseSetInfoService/getLCRiseSetInfo",
          query: {
            serviceKey: apiKey,
            longitude: lon,
            latitude: lat,
            locdate,
            dnYn: "Y",
            _type: "json",
          },
          signal,
        }),
      );

      if (outcome.kind === "http_failure") {
        this.#logger.warn({
          event: WeatherProviderLogEvent.HTTP_FAILED,
          provider: "kasi",
          operation: "sun_time",
          statusCode: outcome.statusCode,
        });
        return null;
      }

      return this.#readSunTime(outcome.body);
    } catch (error) {
      this.#logger.warn({
        event: WeatherProviderLogEvent.REQUEST_FAILED,
        provider: "kasi",
        operation: "sun_time",
        errorType: error instanceof Error ? "error" : "non_error",
      });
      return null;
    }
  }

  #readSunTime(body: unknown): SunTime | null {
    const parsed = kasiSunTimeSchema.safeParse(body);
    if (!parsed.success) {
      return this.#unavailable("invalid_structure");
    }
    const sunTimeResponse = parsed.data;

    const resultCode = sunTimeResponse.response?.header?.resultCode;
    if (resultCode !== "00") {
      return this.#unavailable("provider_result");
    }

    const sunTimeEntry = sunTimeResponse.response?.body?.items?.item;
    if (sunTimeEntry == null) {
      return this.#unavailable("missing_item");
    }

    const sunriseRaw = sunTimeEntry.sunrise;
    const sunsetRaw = sunTimeEntry.sunset;

    if (!sunriseRaw || !sunsetRaw) {
      return this.#unavailable("missing_time");
    }

    const sunrise = this.#formatTime(sunriseRaw);
    const sunset = this.#formatTime(sunsetRaw);

    if (!sunrise || !sunset) {
      return this.#unavailable("invalid_time");
    }

    return { sunrise, sunset };
  }

  #unavailable(errorType: string): null {
    this.#logger.warn({
      event: WeatherProviderLogEvent.RESPONSE_UNAVAILABLE,
      provider: "kasi",
      operation: "sun_time",
      errorType,
    });
    return null;
  }

  #formatTime(raw: string): string | null {
    const trimmed = raw.trim();
    if (trimmed.length < 4) {
      return null;
    }

    const hours = trimmed.slice(0, -2).padStart(2, "0");
    const minutes = trimmed.slice(-2);

    const hourNumber = Number(hours);
    const minuteNumber = Number(minutes);

    if (
      Number.isNaN(hourNumber) ||
      Number.isNaN(minuteNumber) ||
      hourNumber < 0 ||
      hourNumber > 23 ||
      minuteNumber < 0 ||
      minuteNumber > 59
    ) {
      return null;
    }

    return `${hours}:${minutes}`;
  }
}
