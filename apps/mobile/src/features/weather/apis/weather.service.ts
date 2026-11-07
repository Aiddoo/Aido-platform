import {
  type UpdateWeatherLocationInput,
  weatherLocationSchema,
  weatherReportSchema,
} from '@aido/api';
import type { ApiError } from '@src/core/errors/api-error';
import type { Result } from '@src/core/errors/result';
import type { HttpClient } from '@src/core/ports/http';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import type { RegisteredLocation } from '../schemas/weather-location.schema';
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
}
