import { Injectable, Logger } from "@nestjs/common";
import { HttpClient, InjectHttpClient } from "@nestjs/http-client";

import { TypedConfigService } from "#api/platform/config/services/config.service";
import { readJson } from "#api/platform/http/read-json";
import { dayWindowInTimezone, toLocalTimeString } from "#api/shared/domain/date/utils/timezone";

import type {
  LifestyleIndex,
  LifestyleIndexProvider,
} from "../../../application/ports/forecast/lifestyle-index-provider.port.js";
import { WeatherProviderLogEvent } from "../../observability/forecast/weather-provider-log.events.js";
import { KMA_TIMEZONE } from "./kma.constants.js";
import { getRegionCode } from "./region-code.js";

interface UvIndexResponse {
  response?: {
    header?: {
      resultCode?: string;
    };
    body?: {
      items?: {
        item?: Array<{
          h0?: string;
        }>;
      };
    };
  };
}

@Injectable()
export class KmaLifestyleIndexProvider implements LifestyleIndexProvider {
  readonly #logger = new Logger(KmaLifestyleIndexProvider.name);

  constructor(
    private readonly configService: TypedConfigService,
    @InjectHttpClient("weather") private readonly http: HttpClient,
  ) {}

  async getIndex(
    lat: number,
    lon: number,
    date: Date,
    currentTemp: number,
    windSpeed: number,
  ): Promise<LifestyleIndex> {
    const feelsLikeTemperature = this.#calculateFeelsLikeTemperature(currentTemp, windSpeed);

    const apiKey = this.configService.dataGoKrApiKey;
    if (apiKey === undefined || apiKey === null || apiKey === "") {
      this.#logger.warn({
        event: WeatherProviderLogEvent.NOT_CONFIGURED,
        provider: "kma_lifestyle",
        operation: "uv_index",
      });
      return { feelsLikeTemperature, uvIndex: null };
    }

    try {
      const uvIndex = await this.#fetchUvIndex(apiKey, lat, lon, date);
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
    date: Date,
  ): Promise<number | null> {
    const localDate = dayWindowInTimezone(date, KMA_TIMEZONE).localDate.replaceAll("-", "");
    const hour = toLocalTimeString(date, KMA_TIMEZONE).slice(0, 2);
    const time = `${localDate}${hour}`;

    const url = new URL("https://apis.data.go.kr/1360000/LivingWthrIdxServiceV4/getUVIdxV4");
    url.searchParams.set("serviceKey", apiKey);
    url.searchParams.set("numOfRows", "10");
    url.searchParams.set("dataType", "JSON");
    url.searchParams.set("areaNo", getRegionCode(lat, lon));
    url.searchParams.set("time", time);

    const { data: response } = await this.http.request(url.toString(), {
      responseType: "response",
      retry: false,
      throwOnHttpError: false,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      this.#logger.warn({
        event: WeatherProviderLogEvent.HTTP_FAILED,
        provider: "kma_lifestyle",
        operation: "uv_index",
        statusCode: response.status,
      });
      return null;
    }

    const data = await readJson<UvIndexResponse>(response);

    const resultCode = data?.response?.header?.resultCode;
    if (resultCode !== "00") {
      this.#logger.warn({
        event: WeatherProviderLogEvent.RESPONSE_UNAVAILABLE,
        provider: "kma_lifestyle",
        operation: "uv_index",
        errorType: "provider_result",
      });
      return null;
    }

    const items = data?.response?.body?.items?.item;
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
    if (h0Value === undefined || h0Value === null || h0Value === "") {
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
