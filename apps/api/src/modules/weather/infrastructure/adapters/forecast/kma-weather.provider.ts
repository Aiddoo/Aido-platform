import { Injectable, Logger } from "@nestjs/common";
import { HttpClient, InjectHttpClient } from "@nestjs/http-client";

import { TypedConfigService } from "#api/platform/config/services/config.service";
import { readJson } from "#api/platform/http/read-json";
import { ApplicationExceptions } from "#api/shared/application/exceptions/application-exceptions";

import type {
  WeatherForecast,
  WeatherProvider,
} from "../../../application/ports/forecast/weather-provider.port.js";
import { WeatherProviderLogEvent } from "../../observability/forecast/weather-provider-log.events.js";
import { getKmaBaseDateTime } from "./kma-base-datetime.js";
import type { KmaApiResponse } from "./kma-response-parser.js";
import { parseKmaResponse } from "./kma-response-parser.js";
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

    const url = new URL(`${KMA_BASE_URL}${KMA_ENDPOINTS.VILLAGE_FORECAST}`);
    url.searchParams.set("serviceKey", this.configService.dataGoKrApiKey ?? "");
    url.searchParams.set("pageNo", "1");
    url.searchParams.set("numOfRows", "1000");
    url.searchParams.set("dataType", "JSON");
    url.searchParams.set("base_date", baseDate);
    url.searchParams.set("base_time", baseTime);
    url.searchParams.set("nx", String(nx));
    url.searchParams.set("ny", String(ny));

    const { data: response } = await this.http
      .request(url.toString(), {
        responseType: "response",
        retry: false,
        throwOnHttpError: false,
        signal: AbortSignal.timeout(10_000),
      })
      .catch((error: unknown) => {
        this.#logger.error({
          event: WeatherProviderLogEvent.REQUEST_FAILED,
          provider: this.name,
          operation: "forecast",
          errorType: error instanceof Error ? "error" : "non_error",
        });
        throw error;
      });

    if (!response.ok) {
      this.#logger.error({
        event: WeatherProviderLogEvent.HTTP_FAILED,
        provider: this.name,
        operation: "forecast",
        statusCode: response.status,
      });
      throw ApplicationExceptions.weatherServiceUnavailable({
        status: response.status,
      });
    }

    const data = await readJson<KmaApiResponse>(response);

    if (!data?.response?.header?.resultCode) {
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
