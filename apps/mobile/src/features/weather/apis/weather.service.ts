import {
  type UpdateWeatherLocationInput,
  weatherLocationSchema,
  weatherReportSchema,
} from '@aido/api';
import type { ApiError } from '@src/core/errors/api-error';
import type { Result } from '@src/core/errors/result';
import type { HttpClient } from '@src/core/ports/http-client';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import { isLocationNotRegisteredError } from '../domains/weather.error';
import type { Coordinates, RegisteredLocation } from '../schemas/weather-location.schema';
import type { WeatherReport } from '../schemas/weather-report.schema';
import { toRegisteredLocation, toWeatherReport } from './weather.mapper';

export class WeatherService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getReport = async (signal?: AbortSignal): Promise<Result<WeatherReport, ApiError>> =>
    parseApiResponse(
      await this.#httpClient.get('v2/weather', { signal }),
      weatherReportSchema,
      toWeatherReport,
      '[WeatherService] Invalid getReport response',
    );

  updateLocation = async (
    input: UpdateWeatherLocationInput,
    signal?: AbortSignal,
  ): Promise<Result<RegisteredLocation, ApiError>> =>
    parseApiResponse(
      await this.#httpClient.put('v2/weather/location', input, { signal }),
      weatherLocationSchema,
      toRegisteredLocation,
      '[WeatherService] Invalid updateLocation response',
    );

  /**
   * 서버가 위치를 잃었다고(WEATHER_1902) 답하면 마지막으로 등록한 위치를 한 번만 다시 등록하고 다시 받는다.
   * 다시 등록할 위치가 없거나 등록도 실패하면 처음의 1902를 그대로 돌려 위치 안내를 보여 준다.
   */
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
}
