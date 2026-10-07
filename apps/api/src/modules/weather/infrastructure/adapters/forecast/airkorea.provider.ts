import { Injectable, Logger } from "@nestjs/common";
import { HttpClient, InjectHttpClient } from "@nestjs/http-client";

import { TypedConfigService } from "#api/platform/config/services/config.service";
import { readJson } from "#api/platform/http/read-json";

import type {
  AirQuality,
  AirQualityProvider,
} from "../../../application/ports/forecast/air-quality-provider.port.js";
import { WeatherProviderLogEvent } from "../../observability/forecast/weather-provider-log.events.js";
import { convertToTm } from "./wgs84-to-utmk.js";

interface NearbyStationResponse {
  response?: {
    body?: {
      items?: Array<{
        stationName?: string;
      }>;
    };
  };
}

interface AirQualityResponse {
  response?: {
    body?: {
      items?: Array<{
        pm10Value?: string;
        pm25Value?: string;
      }>;
    };
  };
}

@Injectable()
export class AirkoreaProvider implements AirQualityProvider {
  readonly #logger = new Logger(AirkoreaProvider.name);

  constructor(
    private readonly configService: TypedConfigService,
    @InjectHttpClient("weather") private readonly http: HttpClient,
  ) {}

  async getAirQuality(lat: number, lon: number): Promise<AirQuality | null> {
    try {
      const apiKey = this.configService.dataGoKrApiKey;
      if (apiKey === undefined || apiKey === null || apiKey === "") {
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

    const url = new URL("https://apis.data.go.kr/B552584/MsrstnInfoInqireSvc/getNearbyMsrstnList");
    url.searchParams.set("serviceKey", apiKey);
    url.searchParams.set("returnType", "json");
    url.searchParams.set("tmX", String(tmX));
    url.searchParams.set("tmY", String(tmY));
    url.searchParams.set("ver", "1.1");

    const { data: response } = await this.http.request(url.toString(), {
      responseType: "response",
      retry: false,
      throwOnHttpError: false,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      this.#logger.warn({
        event: WeatherProviderLogEvent.HTTP_FAILED,
        provider: "airkorea",
        operation: "nearby_station",
        statusCode: response.status,
      });
      return null;
    }

    const data = await readJson<NearbyStationResponse>(response);

    const items = data?.response?.body?.items;
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
    const url = new URL(
      "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty",
    );
    url.searchParams.set("serviceKey", apiKey);
    url.searchParams.set("returnType", "json");
    url.searchParams.set("stationName", stationName);
    url.searchParams.set("dataTerm", "DAILY");
    url.searchParams.set("ver", "1.5");

    const { data: response } = await this.http.request(url.toString(), {
      responseType: "response",
      retry: false,
      throwOnHttpError: false,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      this.#logger.warn({
        event: WeatherProviderLogEvent.HTTP_FAILED,
        provider: "airkorea",
        operation: "air_quality",
        statusCode: response.status,
      });
      return null;
    }

    const data = await readJson<AirQualityResponse>(response);

    const items = data?.response?.body?.items;
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

  #parseValue(value: string | undefined): number | null {
    if (value === undefined || value === null || value === "" || value === "-") {
      return null;
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return null;
    }

    return parsed;
  }
}
