import { Injectable, Logger } from "@nestjs/common";
import { HttpClient, InjectHttpClient } from "@nestjs/http-client";

import { TypedConfigService } from "#api/platform/config/services/config.service";
import { readJson } from "#api/platform/http/read-json";
import { dayWindowInTimezone } from "#api/shared/domain/date/utils/timezone";

import type {
  SunTime,
  SunTimeProvider,
} from "../../../application/ports/forecast/sun-time-provider.port.js";
import { WeatherProviderLogEvent } from "../../observability/forecast/weather-provider-log.events.js";
import { KMA_TIMEZONE } from "./kma.constants.js";

interface SunTimeResponse {
  response?: {
    header?: {
      resultCode?: string;
    };
    body?: {
      items?: {
        item?: {
          sunrise?: string;
          sunset?: string;
        };
      };
    };
  };
}

@Injectable()
export class KasiSunTimeProvider implements SunTimeProvider {
  readonly #logger = new Logger(KasiSunTimeProvider.name);

  constructor(
    private readonly configService: TypedConfigService,
    @InjectHttpClient("weather") private readonly http: HttpClient,
  ) {}

  async getSunTime(lat: number, lon: number, date: Date): Promise<SunTime | null> {
    try {
      const apiKey = this.configService.dataGoKrApiKey;
      if (apiKey === undefined || apiKey === null || apiKey === "") {
        this.#logger.warn({
          event: WeatherProviderLogEvent.NOT_CONFIGURED,
          provider: "kasi",
          operation: "sun_time",
        });
        return null;
      }

      const locdate = dayWindowInTimezone(date, KMA_TIMEZONE).localDate.replaceAll("-", "");

      const url = new URL(
        "https://apis.data.go.kr/B090041/openapi/service/RiseSetInfoService/getLCRiseSetInfo",
      );
      url.searchParams.set("serviceKey", apiKey);
      url.searchParams.set("longitude", String(lon));
      url.searchParams.set("latitude", String(lat));
      url.searchParams.set("locdate", locdate);
      url.searchParams.set("dnYn", "Y");
      url.searchParams.set("_type", "json");

      const { data: response } = await this.http.request(url.toString(), {
        responseType: "response",
        retry: false,
        throwOnHttpError: false,
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        this.#logger.warn({
          event: WeatherProviderLogEvent.HTTP_FAILED,
          provider: "kasi",
          operation: "sun_time",
          statusCode: response.status,
        });
        return null;
      }

      const data = await readJson<SunTimeResponse>(response);

      const resultCode = data?.response?.header?.resultCode;
      if (resultCode !== "00") {
        this.#logger.warn({
          event: WeatherProviderLogEvent.RESPONSE_UNAVAILABLE,
          provider: "kasi",
          operation: "sun_time",
          errorType: "provider_result",
        });
        return null;
      }

      const item = data?.response?.body?.items?.item;
      if (item === undefined || item === null) {
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
