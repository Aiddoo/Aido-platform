import { Injectable, Logger } from "@nestjs/common";
import { HttpClient, InjectHttpClient } from "@nestjs/http-client";

import { TypedConfigService } from "#api/platform/config/services/config.service";
import { requestVendorJson } from "#api/platform/http/request-vendor-json";
import type { OutboundPolicy } from "#api/platform/resilience/outbound-policy";
import { OutboundRejectedError } from "#api/platform/resilience/outbound-policy.errors";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { ApplicationExceptions } from "#api/shared/application/exceptions/application-exceptions";

import type {
  WeatherForecast,
  WeatherProvider,
} from "../../../application/ports/forecast/weather-provider.port.js";
import {
  KMA_TIMEZONE,
  type KmaForecastTiming,
} from "../../../domain/policies/forecast/kma-forecast-availability.policy.js";
import { WeatherProviderLogEvent } from "../../observability/forecast/weather-provider-log.events.js";
import {
  type KmaBaseDateTime,
  getKmaBaseDateTime,
  getPreviousKmaBaseDateTime,
} from "./kma-base-datetime.js";
import { parseKmaResponse } from "./kma-response-parser.js";
import { type KmaApiResponse, kmaApiResponseSchema } from "./kma-response.schema.js";
import { KMA_BASE_URL, KMA_ENDPOINTS } from "./kma.constants.js";
import { convertToGrid } from "./lambert-projection.js";
import { KMA_FORECAST_POLICY } from "./weather-outbound.policies.js";

@Injectable()
export class KmaWeatherProvider implements WeatherProvider {
  readonly name = "kma";
  readonly timeZone = KMA_TIMEZONE;
  readonly #logger = new Logger(KmaWeatherProvider.name);
  readonly #policy: OutboundPolicy;

  constructor(
    private readonly configService: TypedConfigService,
    @InjectHttpClient("weather") private readonly http: HttpClient,
    policies: OutboundPolicyRegistry,
  ) {
    this.#policy = policies.get(KMA_FORECAST_POLICY);
  }

  async getForecast(lat: number, lon: number, timing: KmaForecastTiming): Promise<WeatherForecast> {
    const grid = convertToGrid(lat, lon);

    const current = await this.#requestForecast(grid, getKmaBaseDateTime(timing.issuance));
    if (current.response.header.resultCode === "00") {
      return parseKmaResponse(current, timing.target);
    }

    // 실패 코드는 일시적으로 발생하고 3시간 전 직전 발표도 대상일 예보를 포함하므로 한 번만 대체한다.
    this.#logger.warn({
      event: WeatherProviderLogEvent.PREVIOUS_BASE_RETRIED,
      provider: this.name,
      operation: "forecast",
      resultCode: current.response.header.resultCode,
    });
    const previous = await this.#requestForecast(grid, getPreviousKmaBaseDateTime(timing.issuance));
    if (previous.response.header.resultCode === "00") {
      return parseKmaResponse(previous, timing.target);
    }

    this.#logger.error({
      event: WeatherProviderLogEvent.RESPONSE_UNAVAILABLE,
      provider: this.name,
      operation: "forecast",
      errorType: "provider_result",
      resultCode: previous.response.header.resultCode,
    });
    throw ApplicationExceptions.weatherServiceUnavailable({
      code: previous.response.header.resultCode,
      message: previous.response.header.resultMsg,
    });
  }

  async #requestForecast(
    { nx, ny }: ReturnType<typeof convertToGrid>,
    { baseDate, baseTime }: KmaBaseDateTime,
  ): Promise<KmaApiResponse> {
    const outcome = await this.#policy
      .execute((signal) =>
        requestVendorJson(
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
          { signal },
        ),
      )
      .catch((error: unknown) => {
        // 회로가 열려 부르지 않은 요청은 공용 정책이 연 순간 한 번만 남긴다.
        if (error instanceof OutboundRejectedError) {
          throw error;
        }
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
    return parsed.data;
  }

  isConfigured(): boolean {
    return Boolean(this.configService.dataGoKrApiKey);
  }
}
