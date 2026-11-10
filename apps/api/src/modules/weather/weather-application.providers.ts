import { Logger, type FactoryProvider } from "@nestjs/common";

import { AIR_QUALITY_PROVIDER } from "./forecasts/application/ports/air-quality-provider.port.js";
import { LIFESTYLE_INDEX_PROVIDER } from "./forecasts/application/ports/lifestyle-index-provider.port.js";
import { SUN_TIME_PROVIDER } from "./forecasts/application/ports/sun-time-provider.port.js";
import { WEATHER_CACHE } from "./forecasts/application/ports/weather-forecast-cache.port.js";
import { WEATHER_PROVIDER } from "./forecasts/application/ports/weather-forecast-provider.port.js";
import { WEATHER_REPORT_CACHE } from "./forecasts/application/ports/weather-report-cache.port.js";
import { WEATHER_REPORT_PROVIDER } from "./forecasts/application/ports/weather-report-provider.port.js";
import { WEATHER_REPORT_READER } from "./forecasts/application/ports/weather-report.reader.port.js";
import { GetWeatherConditions } from "./forecasts/application/use-cases/get-weather-conditions.use-case.js";
import { GetWeatherForecast } from "./forecasts/application/use-cases/get-weather-forecast.use-case.js";
import { GetWeatherReport } from "./forecasts/application/use-cases/get-weather-report.use-case.js";
import { WeatherForecastReader } from "./forecasts/application/weather-forecast.reader.js";
import { WeatherReportReader } from "./forecasts/application/weather-report.reader.js";
import { TIMEZONE_RESOLVER } from "./locations/application/ports/timezone-resolver.port.js";
import { WEATHER_LOCATION_REPOSITORY } from "./locations/application/ports/user-location.repository.port.js";
import { WEATHER_GRID_RESOLVER } from "./locations/application/ports/weather-grid-resolver.port.js";
import { UpsertLocation } from "./locations/application/use-cases/upsert-user-location.use-case.js";

export const getWeatherConditionsProvider: FactoryProvider<GetWeatherConditions> = {
  provide: GetWeatherConditions,
  inject: [
    WEATHER_LOCATION_REPOSITORY,
    AIR_QUALITY_PROVIDER,
    LIFESTYLE_INDEX_PROVIDER,
    SUN_TIME_PROVIDER,
    WEATHER_PROVIDER,
    WeatherForecastReader,
    WEATHER_CACHE,
  ],
  useFactory: (
    weatherLocationRepository: ConstructorParameters<
      typeof GetWeatherConditions
    >[0]["weatherLocationRepository"],
    airQualityProvider: ConstructorParameters<typeof GetWeatherConditions>[0]["airQualityProvider"],
    lifestyleIndexProvider: ConstructorParameters<
      typeof GetWeatherConditions
    >[0]["lifestyleIndexProvider"],
    sunTimeProvider: ConstructorParameters<typeof GetWeatherConditions>[0]["sunTimeProvider"],
    weatherProvider: ConstructorParameters<typeof GetWeatherConditions>[0]["weatherProvider"],
    forecastReader: ConstructorParameters<typeof GetWeatherConditions>[0]["forecastReader"],
    weatherCache: ConstructorParameters<typeof GetWeatherConditions>[0]["weatherCache"],
  ) =>
    new GetWeatherConditions({
      weatherLocationRepository,
      airQualityProvider,
      lifestyleIndexProvider,
      sunTimeProvider,
      weatherProvider,
      forecastReader,
      weatherCache,
      logger: new Logger(GetWeatherConditions.name),
    }),
};

export const getWeatherForecastProvider: FactoryProvider<GetWeatherForecast> = {
  provide: GetWeatherForecast,
  inject: [WEATHER_LOCATION_REPOSITORY, WeatherForecastReader],
  useFactory: (
    weatherLocationRepository: ConstructorParameters<
      typeof GetWeatherForecast
    >[0]["weatherLocationRepository"],
    forecastReader: ConstructorParameters<typeof GetWeatherForecast>[0]["forecastReader"],
  ) => new GetWeatherForecast({ weatherLocationRepository, forecastReader }),
};

export const weatherForecastReaderProvider: FactoryProvider<WeatherForecastReader> = {
  provide: WeatherForecastReader,
  inject: [WEATHER_PROVIDER, WEATHER_CACHE],
  useFactory: (
    weatherProvider: ConstructorParameters<typeof WeatherForecastReader>[0]["weatherProvider"],
    weatherCache: ConstructorParameters<typeof WeatherForecastReader>[0]["weatherCache"],
  ) =>
    new WeatherForecastReader({
      weatherProvider,
      weatherCache,
      logger: new Logger(WeatherForecastReader.name),
    }),
};

export const upsertLocationProvider: FactoryProvider<UpsertLocation> = {
  provide: UpsertLocation,
  inject: [WEATHER_LOCATION_REPOSITORY, WEATHER_CACHE, WEATHER_GRID_RESOLVER, TIMEZONE_RESOLVER],
  useFactory: (
    weatherLocationRepository: ConstructorParameters<
      typeof UpsertLocation
    >[0]["weatherLocationRepository"],
    weatherCache: ConstructorParameters<typeof UpsertLocation>[0]["weatherCache"],
    weatherGridResolver: ConstructorParameters<typeof UpsertLocation>[0]["weatherGridResolver"],
    timezoneResolver: ConstructorParameters<typeof UpsertLocation>[0]["timezoneResolver"],
  ) =>
    new UpsertLocation({
      weatherLocationRepository,
      weatherCache,
      weatherGridResolver,
      timezoneResolver,
    }),
};

export const getWeatherReportProvider: FactoryProvider<GetWeatherReport> = {
  provide: GetWeatherReport,
  inject: [
    WEATHER_LOCATION_REPOSITORY,
    WEATHER_REPORT_READER,
    WEATHER_REPORT_PROVIDER,
    WEATHER_REPORT_CACHE,
    TIMEZONE_RESOLVER,
    AIR_QUALITY_PROVIDER,
  ],
  useFactory: (
    weatherLocationRepository: ConstructorParameters<
      typeof GetWeatherReport
    >[0]["weatherLocationRepository"],
    weatherReportReader: ConstructorParameters<typeof GetWeatherReport>[0]["weatherReportReader"],
    weatherReportProvider: ConstructorParameters<
      typeof GetWeatherReport
    >[0]["weatherReportProvider"],
    weatherReportCache: ConstructorParameters<typeof GetWeatherReport>[0]["weatherReportCache"],
    timezoneResolver: ConstructorParameters<typeof GetWeatherReport>[0]["timezoneResolver"],
    airQualityProvider: ConstructorParameters<typeof GetWeatherReport>[0]["airQualityProvider"],
  ) =>
    new GetWeatherReport({
      weatherLocationRepository,
      weatherReportReader,
      weatherReportProvider,
      weatherReportCache,
      timezoneResolver,
      airQualityProvider,
      logger: new Logger(GetWeatherReport.name),
    }),
};

export const weatherReportReaderProvider: FactoryProvider<WeatherReportReader> = {
  provide: WeatherReportReader,
  inject: [WEATHER_REPORT_PROVIDER, WEATHER_REPORT_CACHE, TIMEZONE_RESOLVER],
  useFactory: (
    weatherReportProvider: ConstructorParameters<
      typeof WeatherReportReader
    >[0]["weatherReportProvider"],
    weatherReportCache: ConstructorParameters<typeof WeatherReportReader>[0]["weatherReportCache"],
    timezoneResolver: ConstructorParameters<typeof WeatherReportReader>[0]["timezoneResolver"],
  ) =>
    new WeatherReportReader({
      weatherReportProvider,
      weatherReportCache,
      timezoneResolver,
      logger: new Logger(WeatherReportReader.name),
    }),
};
