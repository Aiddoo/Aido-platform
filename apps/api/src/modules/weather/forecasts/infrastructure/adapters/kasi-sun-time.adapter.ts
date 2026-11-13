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
  weatherForecastsConfig,
  type WeatherForecastsConfig,
} from "../../weather-forecasts.config.js";
import { kasiSunTimeSchema } from "./kasi.wire.js";
import { KASI_POLICY } from "./weather-outbound.policy.js";
import { WeatherProviderLogEvent } from "./weather-provider.log-events.js";

@Injectable()
export class KasiSunTimeAdapter implements SunTimeProviderPort {
  readonly #logger = new Logger(KasiSunTimeAdapter.name);

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

    this.#policy = policies.get(KASI_POLICY);
  }

  async getSunTime(lat: number, lon: number, at: Temporal.Instant): Promise<SunTime | null> {
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
        requestVendorJson(
          this.#http,
          "https://apis.data.go.kr/B090041/openapi/service/RiseSetInfoService/getLCRiseSetInfo",
          {
            serviceKey: apiKey,
            longitude: lon,
            latitude: lat,
            locdate,
            dnYn: "Y",
            _type: "json",
          },
          { signal },
        ),
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

      const parsed = kasiSunTimeSchema.safeParse(outcome.body);
      if (!parsed.success) {
        this.#logger.warn({
          event: WeatherProviderLogEvent.RESPONSE_UNAVAILABLE,
          provider: "kasi",
          operation: "sun_time",
          errorType: "invalid_structure",
        });
        return null;
      }
      const data = parsed.data;

      const resultCode = data.response?.header?.resultCode;
      if (resultCode !== "00") {
        this.#logger.warn({
          event: WeatherProviderLogEvent.RESPONSE_UNAVAILABLE,
          provider: "kasi",
          operation: "sun_time",
          errorType: "provider_result",
        });
        return null;
      }

      const item = data.response?.body?.items?.item;
      if (item == null) {
        this.#logger.warn({
          event: WeatherProviderLogEvent.RESPONSE_UNAVAILABLE,
          provider: "kasi",
          operation: "sun_time",
          errorType: "missing_item",
        });
        return null;
      }

      const sunriseRaw = item.sunrise;
      const sunsetRaw = item.sunset;

      if (!sunriseRaw || !sunsetRaw) {
        this.#logger.warn({
          event: WeatherProviderLogEvent.RESPONSE_UNAVAILABLE,
          provider: "kasi",
          operation: "sun_time",
          errorType: "missing_time",
        });
        return null;
      }

      const sunrise = this.#formatTime(sunriseRaw);
      const sunset = this.#formatTime(sunsetRaw);

      if (!sunrise || !sunset) {
        this.#logger.warn({
          event: WeatherProviderLogEvent.RESPONSE_UNAVAILABLE,
          provider: "kasi",
          operation: "sun_time",
          errorType: "invalid_time",
        });
        return null;
      }

      return { sunrise, sunset };
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

  #formatTime(raw: string): string | null {
    const trimmed = raw.trim();
    if (trimmed.length < 4) {
      return null;
    }

    const hours = trimmed.slice(0, -2).padStart(2, "0");
    const minutes = trimmed.slice(-2);

    const hoursNum = Number(hours);
    const minutesNum = Number(minutes);

    if (
      Number.isNaN(hoursNum) ||
      Number.isNaN(minutesNum) ||
      hoursNum < 0 ||
      hoursNum > 23 ||
      minutesNum < 0 ||
      minutesNum > 59
    ) {
      return null;
    }

    return `${hours}:${minutes}`;
  }
}
