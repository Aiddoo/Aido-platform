import { Injectable, Logger } from "@nestjs/common";
import { HttpClient, InjectHttpClient } from "@nestjs/http-client";

import { TypedConfigService } from "#api/platform/config/services/config.service";
import { readJson } from "#api/platform/http/read-json";
import { ApplicationExceptions } from "#api/shared/application/exceptions/application-exceptions";

import type {
  WeatherForecast,
  WeatherProvider,
} from "../../../application/ports/forecast/weather-provider.port.js";
import { getKmaBaseDateTime } from "../../../domain/services/forecast/kma-base-datetime.js";
import { convertToGrid } from "../../../domain/services/forecast/lambert-projection.js";
import type { KmaApiResponse } from "./kma-response-parser.js";
import { parseKmaResponse } from "./kma-response-parser.js";
import { KMA_BASE_URL, KMA_ENDPOINTS } from "./kma.constants.js";

@Injectable()
export class KmaWeatherProvider implements WeatherProvider {
  readonly name = "kma";
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

    const { data: response } = await this.http.request(url.toString(), {
      responseType: "response",
      retry: false,
      throwOnHttpError: false,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      this.#logger.error(`KMA API error: status=${response.status}, url=${url.pathname}`);
      throw ApplicationExceptions.weatherServiceUnavailable({
        status: response.status,
      });
    }

    const data = await readJson<KmaApiResponse>(response);

    if (!data?.response?.header?.resultCode) {
      this.#logger.error("KMA API: unexpected response structure");
      throw ApplicationExceptions.weatherServiceUnavailable({
        reason: "unexpected response structure",
      });
    }

    if (data.response.header.resultCode !== "00") {
      this.#logger.error(
        `KMA API error: code=${data.response.header.resultCode}, msg=${data.response.header.resultMsg}`,
      );
      throw ApplicationExceptions.weatherServiceUnavailable({
        code: data.response.header.resultCode,
        message: data.response.header.resultMsg,
      });
    }

    return parseKmaResponse(data, date);
  }

  isConfigured(): boolean {
    return !!this.configService.dataGoKrApiKey;
  }
}
