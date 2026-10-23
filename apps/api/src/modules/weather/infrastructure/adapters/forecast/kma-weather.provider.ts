import { Injectable, Logger } from "@nestjs/common";
import { HttpClient, InjectHttpClient } from "@nestjs/http-client";

import { TypedConfigService } from "#api/platform/config/services/config.service";
import { requestVendorJson } from "#api/platform/http/request-vendor-json";
import { ApplicationExceptions } from "#api/shared/application/exceptions/application-exceptions";

import type {
  WeatherForecast,
  WeatherProvider,
} from "../../../application/ports/forecast/weather-provider.port.js";
import { WeatherProviderLogEvent } from "../../observability/forecast/weather-provider-log.events.js";
import { getKmaBaseDateTime } from "./kma-base-datetime.js";
import { parseKmaResponse } from "./kma-response-parser.js";
import { kmaApiResponseSchema } from "./kma-response.schema.js";
import { KMA_BASE_URL, KMA_ENDPOINTS, KMA_TIMEZONE } from "./kma.constants.js";
import { convertToGrid } from "./lambert-projection.js";

@Injectable()
export class KmaWeatherProvider implements WeatherProvider {
  readonly name = "kma";
  readonly timeZone = KMA_TIMEZONE;
  readonly #logger = new Logger(KmaWeatherProvider.name);

  constructor(
    private readonly configService: TypedConfigService,
    @InjectHttpClient("weather") private readonly http: HttpClient,
  ) {}

  async getForecast(lat: number, lon: number, date: Date): Promise<WeatherForecast> {
    const { nx, ny } = convertToGrid(lat, lon);
    const { baseDate, baseTime } = getKmaBaseDateTime(date);

    const outcome = await requestVendorJson(
      this.http,
      `${KMA_BASE_URL}${KMA_ENDPOINTS.VILLAGE_FORECAST}`,
      {
        serviceKey: this.configService.dataGoKrApiKey ?? "",
        pageNo: 1,
        numOfRows: 1000,
        dataType: "JSON",
        base_date: baseDate,
        base_time: baseTime,
        nx,
        ny,
      },
    ).catch((error: unknown) => {
      this.#logger.error({
        event: WeatherProviderLogEvent.REQUEST_FAILED,
        provider: this.name,
        operation: "forecast",
        errorType: error instanceof Error ? "error" : "non_error",
      });
      throw error;
    });

    if (outcome.kind === "http_failure") {
      this.#logger.error({
        event: WeatherProviderLogEvent.HTTP_FAILED,
        provider: this.name,
        operation: "forecast",
        statusCode: outcome.statusCode,
      });
      throw ApplicationExceptions.weatherServiceUnavailable({
        status: outcome.statusCode,
      });
    }

    const parsed = kmaApiResponseSchema.safeParse(outcome.body);
    if (!parsed.success) {
      this.#logger.error({
        event: WeatherProviderLogEvent.RESPONSE_UNAVAILABLE,
        provider: this.name,
        operation: "forecast",
        errorType: "invalid_structure",
      });
      throw ApplicationExceptions.weatherServiceUnavailable({
        reason: "unexpected response structure",
      });
    }
    const data = parsed.data;

    if (data.response.header.resultCode !== "00") {
      this.#logger.error({
        event: WeatherProviderLogEvent.RESPONSE_UNAVAILABLE,
        provider: this.name,
        operation: "forecast",
        errorType: "provider_result",
      });
      throw ApplicationExceptions.weatherServiceUnavailable({
        code: data.response.header.resultCode,
        message: data.response.header.resultMsg,
      });
    }

    return parseKmaResponse(data, date);
  }

  isConfigured(): boolean {
    return Boolean(this.configService.dataGoKrApiKey);
  }
}
