import {
  locationResponseSchema,
  type UpdateLocationInput,
  weatherConditionsSchema,
  weatherForecastSchema,
  weatherLocationSchema,
  weatherReportSchema,
  type UpdateWeatherLocationInput,
} from '@aido/api';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import type { RegisteredLocation } from '../domains/weather-location.model';
import type { WeatherReport } from '../domains/weather-report.model';
import type { Location, WeatherConditions, WeatherForecast } from '../domains/weather.model';
import {
  toLocation,
  toRegisteredLocation,
  toWeatherConditions,
  toWeatherForecast,
  toWeatherReport,
} from './weather.mapper';

export class WeatherService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getForecast = async (
    date: string,
    signal?: AbortSignal,
  ): Promise<Result<WeatherForecast, ApiError>> => {
    const result = await this.#httpClient.get('v1/weather/forecast', { signal, params: { date } });

    if (!result.ok) {
      return result;
    }

    const parsed = weatherForecastSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[WeatherService] Invalid getForecast response: ${parsed.error.message}`,
      );
    }

    return ok(toWeatherForecast(parsed.data));
  };

  getConditions = async (signal?: AbortSignal): Promise<Result<WeatherConditions, ApiError>> => {
    const result = await this.#httpClient.get('v1/weather/conditions', { signal });

    if (!result.ok) {
      return result;
    }

    const parsed = weatherConditionsSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[WeatherService] Invalid getConditions response: ${parsed.error.message}`,
      );
    }

    return ok(toWeatherConditions(parsed.data));
  };

  updateLocation = async (
    input: UpdateLocationInput,
    signal?: AbortSignal,
  ): Promise<Result<Location, ApiError>> => {
    const result = await this.#httpClient.put('v1/weather/location', input, { signal });

    if (!result.ok) {
      return result;
    }

    const parsed = locationResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[WeatherService] Invalid updateLocation response: ${parsed.error.message}`,
      );
    }

    return ok(toLocation(parsed.data));
  };

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

  registerLocation = async (
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
        `[WeatherService] Invalid registerLocation response: ${parsed.error.message}`,
      );
    }

    return ok(toRegisteredLocation(parsed.data));
  };
}
