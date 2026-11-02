import {
  type UpdateWeatherLocationInput,
  weatherLocationSchema,
  weatherReportSchema,
} from '@aido/api';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import type { RegisteredLocation } from '../domains/weather-location.model';
import type { WeatherReport } from '../domains/weather-report.model';
import { toRegisteredLocation, toWeatherReport } from './weather.mapper';

export class WeatherService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getReport = async (signal?: AbortSignal): Promise<Result<WeatherReport, ApiError>> => {
    const result = await this.#httpClient.get('v2/weather', { signal });

    if (!result.ok) {
      return result;
    }

    const parsed = weatherReportSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[WeatherService] Invalid getReport response: ${parsed.error.message}`);
    }

    return ok(toWeatherReport(parsed.data));
  };

  updateLocation = async (
    input: UpdateWeatherLocationInput,
    signal?: AbortSignal,
  ): Promise<Result<RegisteredLocation, ApiError>> => {
    const result = await this.#httpClient.put('v2/weather/location', input, { signal });

    if (!result.ok) {
      return result;
    }

    const parsed = weatherLocationSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[WeatherService] Invalid updateLocation response: ${parsed.error.message}`,
      );
    }

    return ok(toRegisteredLocation(parsed.data));
  };
}
