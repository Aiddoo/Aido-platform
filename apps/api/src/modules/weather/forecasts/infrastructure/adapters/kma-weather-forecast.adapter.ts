import { Inject, Injectable, Logger } from "@nestjs/common";
import { HttpClient, InjectHttpClient } from "@nestjs/http-client";

import { requestVendorJson } from "#api/platform/http/request-vendor-json";
import type { OutboundPolicy } from "#api/platform/resilience/outbound-policy";
import { OutboundRejectedError } from "#api/platform/resilience/outbound-policy.errors";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";

import { convertToGrid } from "../../../shared/domain/kma-grid-projection.domain-service.js";
import { weatherServiceUnavailable } from "../../application/forecasts.errors.js";
import type { WeatherForecastProviderPort } from "../../application/ports/weather-forecast-provider.port.js";
import type { WeatherForecast } from "../../application/read-models/weather-forecast.read-model.js";
import {
  type KmaBaseDateTime,
  getKmaBaseDateTime,
  getPreviousKmaBaseDateTime,
} from "../../domain/kma-base-datetime.domain-service.js";
import {
  KMA_TIMEZONE,
  type KmaForecastTiming,
} from "../../domain/kma-forecast-availability.domain-service.js";
import {
  weatherForecastsConfig,
  type WeatherForecastsConfig,
} from "../../weather-forecasts.config.js";
import { WeatherProviderLogEvent } from "../weather-provider.log-events.js";
import { parseKmaResponse } from "./kma-forecast-response.mapper.js";
import { KMA_BASE_URL, KMA_ENDPOINTS } from "./kma.constants.js";
import { type KmaApiResponse, kmaApiResponseSchema } from "./kma.wire.js";
import { KMA_FORECAST_POLICY } from "./weather-outbound.policy.js";

@Injectable()
export class KmaWeatherForecastAdapter implements WeatherForecastProviderPort {
  readonly name = "kma";
  readonly timeZone = KMA_TIMEZONE;
  readonly #logger = new Logger(KmaWeatherForecastAdapter.name);
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
    throw weatherServiceUnavailable({
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
          this.#http,
          `${KMA_BASE_URL}${KMA_ENDPOINTS.VILLAGE_FORECAST}`,
          {
            serviceKey: this.#config.kmaApiKey ?? "",
            pageNo: 1,
            numOfRows: 1_000,
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
      throw weatherServiceUnavailable({
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
      throw weatherServiceUnavailable({
        reason: "unexpected response structure",
      });
    }
    return parsed.data;
  }

  isConfigured(): boolean {
    return Boolean(this.#config.kmaApiKey);
  }
}
