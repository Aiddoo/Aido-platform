import {
  type UpdateWeatherLocationInput,
  weatherLocationSchema,
  weatherReportSchema,
} from '@aido/api';
import type { ApiError } from '@src/core/errors/api-error';
import type { Result } from '@src/core/errors/result';
import type { HttpClient } from '@src/core/ports/http-client';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import type { Coordinates } from '../domains/weather-location.model';
import type { RegisteredLocation } from '../domains/weather-report.model';
import type { WeatherReport } from '../domains/weather-report.model';
import { isLocationNotRegisteredError } from '../domains/weather.error';
import { toRegisteredLocation, toWeatherReport } from './weather.mapper';

export class WeatherApi {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getReport = async (signal?: AbortSignal): Promise<Result<WeatherReport, ApiError>> =>
    parseApiResponse(
      await this.#httpClient.get('v2/weather', { signal }),
      weatherReportSchema,
      toWeatherReport,
      '[WeatherApi] Invalid getReport response',
    );

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
}
