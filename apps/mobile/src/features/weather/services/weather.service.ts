import {
  type LocationResponse,
  locationResponseSchema,
  type UpdateLocationInput,
  type WeatherForecastResponse,
  weatherForecastSchema,
} from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import type { Location, WeatherForecast } from '../models/weather.model';
import { toLocation, toWeatherForecast } from './weather.mapper';

export class WeatherService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getForecast = async (date: string): Promise<Result<WeatherForecast, ApiError>> => {
    const result = await this.#httpClient.get<WeatherForecastResponse>('v1/weather/forecast', {
      params: { date },
    });

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

  updateLocation = async (input: UpdateLocationInput): Promise<Result<Location, ApiError>> => {
    const result = await this.#httpClient.put<LocationResponse>('v1/weather/location', input);

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
}
