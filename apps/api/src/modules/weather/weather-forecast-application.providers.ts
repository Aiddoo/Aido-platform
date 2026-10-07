import { Logger, type FactoryProvider } from "@nestjs/common";

import { AIR_QUALITY_PROVIDER } from "./application/ports/forecast/air-quality-provider.port.js";
import { LIFESTYLE_INDEX_PROVIDER } from "./application/ports/forecast/lifestyle-index-provider.port.js";
import { SUN_TIME_PROVIDER } from "./application/ports/forecast/sun-time-provider.port.js";
import { WEATHER_CACHE } from "./application/ports/forecast/weather-cache.port.js";
import { WEATHER_LOCATION_REPOSITORY } from "./application/ports/forecast/weather-location.repository.port.js";
import { WEATHER_PROVIDER } from "./application/ports/forecast/weather-provider.port.js";
import { WeatherForecastReader } from "./application/services/forecast/weather-forecast.reader.js";
import { GetForecastsByGridBatch } from "./application/use-cases/forecast/get-forecasts-by-grid-batch.use-case.js";
import { GetWeatherConditions } from "./application/use-cases/forecast/get-weather-conditions.use-case.js";
import { GetWeatherForecast } from "./application/use-cases/forecast/get-weather-forecast.use-case.js";
import { UpsertLocation } from "./application/use-cases/forecast/upsert-location.use-case.js";

export const getForecastsByGridBatchProvider: FactoryProvider<GetForecastsByGridBatch> = {
  provide: GetForecastsByGridBatch,
  inject: [WeatherForecastReader],
  useFactory: (
    forecastReader: ConstructorParameters<typeof GetForecastsByGridBatch>[0]["forecastReader"],
  ) => new GetForecastsByGridBatch({ forecastReader }),
};

export const getWeatherConditionsProvider: FactoryProvider<GetWeatherConditions> = {
  provide: GetWeatherConditions,
  inject: [
    WEATHER_LOCATION_REPOSITORY,
    AIR_QUALITY_PROVIDER,
    LIFESTYLE_INDEX_PROVIDER,
    SUN_TIME_PROVIDER,
    WeatherForecastReader,
    WEATHER_CACHE,
  ],
  useFactory: (
    repository: ConstructorParameters<typeof GetWeatherConditions>[0]["repository"],
    airQualityProvider: ConstructorParameters<typeof GetWeatherConditions>[0]["airQualityProvider"],
    lifestyleIndexProvider: ConstructorParameters<
      typeof GetWeatherConditions
    >[0]["lifestyleIndexProvider"],
    sunTimeProvider: ConstructorParameters<typeof GetWeatherConditions>[0]["sunTimeProvider"],
    forecastReader: ConstructorParameters<typeof GetWeatherConditions>[0]["forecastReader"],
    cache: ConstructorParameters<typeof GetWeatherConditions>[0]["cache"],
  ) =>
    new GetWeatherConditions({
      repository,
      airQualityProvider,
      lifestyleIndexProvider,
      sunTimeProvider,
      forecastReader,
      cache,
      logger: new Logger(GetWeatherConditions.name),
    }),
};

export const getWeatherForecastProvider: FactoryProvider<GetWeatherForecast> = {
  provide: GetWeatherForecast,
  inject: [WEATHER_LOCATION_REPOSITORY, WeatherForecastReader],
  useFactory: (
    repository: ConstructorParameters<typeof GetWeatherForecast>[0]["repository"],
    forecastReader: ConstructorParameters<typeof GetWeatherForecast>[0]["forecastReader"],
  ) => new GetWeatherForecast({ repository, forecastReader }),
};

export const weatherForecastReaderProvider: FactoryProvider<WeatherForecastReader> = {
  provide: WeatherForecastReader,
  inject: [WEATHER_PROVIDER, WEATHER_CACHE],
  useFactory: (
    weatherProvider: ConstructorParameters<typeof WeatherForecastReader>[0]["weatherProvider"],
    cache: ConstructorParameters<typeof WeatherForecastReader>[0]["cache"],
  ) =>
    new WeatherForecastReader({
      weatherProvider,
      cache,
      logger: new Logger(WeatherForecastReader.name),
    }),
};

export const upsertLocationProvider: FactoryProvider<UpsertLocation> = {
  provide: UpsertLocation,
  inject: [WEATHER_LOCATION_REPOSITORY, WEATHER_CACHE],
  useFactory: (
    repository: ConstructorParameters<typeof UpsertLocation>[0]["repository"],
    cache: ConstructorParameters<typeof UpsertLocation>[0]["cache"],
  ) => new UpsertLocation({ repository, cache }),
};
