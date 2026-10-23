import { Injectable, Logger } from "@nestjs/common";
import { HttpClient, InjectHttpClient } from "@nestjs/http-client";
import { z } from "zod";

import { TypedConfigService } from "#api/platform/config/services/config.service";
import { requestVendorJson } from "#api/platform/http/request-vendor-json";

import type {
  AirQuality,
  AirQualityProvider,
} from "../../../application/ports/forecast/air-quality-provider.port.js";
import { WeatherProviderLogEvent } from "../../observability/forecast/weather-provider-log.events.js";
import { convertToTm } from "./wgs84-to-utmk.js";

const nearbyStationResponseSchema = z.object({
  response: z
    .object({
      body: z
        .object({
          items: z
            .array(z.object({ stationName: z.string().nullish() }))
            .optional()
            .catch(undefined),
        })
        .optional(),
    })
    .optional(),
});

const airQualityResponseSchema = z.object({
  response: z
    .object({
      body: z
        .object({
          items: z
            .array(z.object({ pm10Value: z.string().nullish(), pm25Value: z.string().nullish() }))
            .optional()
            .catch(undefined),
        })
        .optional(),
    })
    .optional(),
});

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

    const outcome = await requestVendorJson(
      this.http,
      "https://apis.data.go.kr/B552584/MsrstnInfoInqireSvc/getNearbyMsrstnList",
      {
        serviceKey: apiKey,
        returnType: "json",
        tmX,
        tmY,
        ver: "1.1",
      },
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

    const parsed = nearbyStationResponseSchema.safeParse(outcome.body);
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
    const outcome = await requestVendorJson(
      this.http,
      "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty",
      {
        serviceKey: apiKey,
        returnType: "json",
        stationName,
        dataTerm: "DAILY",
        ver: "1.5",
      },
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

    const parsed = airQualityResponseSchema.safeParse(outcome.body);
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

  #parseValue(value: string | null | undefined): number | null {
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
