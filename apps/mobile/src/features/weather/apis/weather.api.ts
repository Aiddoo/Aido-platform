import {
  type UpdateWeatherLocationInput,
  weatherLocationSchema,
  weatherReportSchema,
} from '@aido/api';
import type { ApiError } from '@src/core/errors/api-error';
import type { Result } from '@src/core/errors/result';
import type { AppLogger } from '@src/core/ports/app-logger';
import type { HttpClient } from '@src/core/ports/http-client';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import { WEATHER_LOG_EVENT } from '../constants/weather-log-events';
import type { Coordinates } from '../domains/weather-location.model';
import type { RegisteredLocation } from '../domains/weather-report.model';
import type { WeatherReport } from '../domains/weather-report.model';
import { isLocationNotRegisteredError } from '../domains/weather.error';
import { getFallbackFieldPaths, toRegisteredLocation, toWeatherReport } from './weather.mapper';

export class WeatherApi {
  readonly #httpClient: HttpClient;
  readonly #logger: AppLogger;

  constructor(httpClient: HttpClient, logger: AppLogger) {
    this.#httpClient = httpClient;
    this.#logger = logger;
  }

  getReport = async (signal?: AbortSignal): Promise<Result<WeatherReport, ApiError>> => {
    const response = await this.#httpClient.get('v2/weather', { signal });
    return parseApiResponse(
      response,
      weatherReportSchema,
      (dto) => {
        if (response.ok) {
          this.#logFallbackFields(response.value, dto);
        }
        return toWeatherReport(dto);
      },
      '[WeatherApi] Invalid getReport response',
    );
  };

  updateLocation = async (
    input: UpdateWeatherLocationInput,
    signal?: AbortSignal,
  ): Promise<Result<RegisteredLocation, ApiError>> =>
    parseApiResponse(
      await this.#httpClient.put('v2/weather/location', input, { signal }),
      weatherLocationSchema,
      toRegisteredLocation,
      '[WeatherApi] Invalid updateLocation response',
    );

  // 서버가 위치를 잃으면(WEATHER_1902) 한 번만 다시 등록하고, 그것도 안 되면 처음의 1902를 돌려 위치 안내를 띄운다
  getReportWithReregistration = async ({
    lastRegistered,
    signal,
  }: {
    lastRegistered: Coordinates | null;
    signal?: AbortSignal;
  }): Promise<Result<WeatherReport, ApiError>> => {
    const result = await this.getReport(signal);
    if (result.ok || !isLocationNotRegisteredError(result.error) || lastRegistered == null) {
      return result;
    }
    const registration = await this.updateLocation(lastRegistered, signal);
    if (!registration.ok) {
      return result;
    }
    return this.getReport(signal);
  };

  /** 계약이 모르는 열거 값을 대체값으로 읽었으면 서버가 새 값을 보내기 시작했다는 신호라 칸 경로만 남긴다 */
  #logFallbackFields = (raw: unknown, dto: unknown) => {
    const fields = getFallbackFieldPaths(raw, dto);
    if (fields.length > 0) {
      this.#logger.warn(WEATHER_LOG_EVENT.REPORT_ENUM_FALLBACK, { fields: fields.join(',') });
    }
  };
}
