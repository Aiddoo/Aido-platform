import { Logger, type FactoryProvider } from "@nestjs/common";

import { AIR_QUALITY_PROVIDER } from "./application/ports/forecast/air-quality-provider.port.js";
import { LIFESTYLE_INDEX_PROVIDER } from "./application/ports/forecast/lifestyle-index-provider.port.js";
import { SUN_TIME_PROVIDER } from "./application/ports/forecast/sun-time-provider.port.js";
import { TIMEZONE_RESOLVER } from "./application/ports/forecast/timezone.resolver.port.js";
import { WEATHER_CACHE } from "./application/ports/forecast/weather-cache.port.js";
import { WEATHER_GRID_RESOLVER } from "./application/ports/forecast/weather-grid-resolver.port.js";
import { WEATHER_LOCATION_REPOSITORY } from "./application/ports/forecast/weather-location.repository.port.js";
import { WEATHER_PROVIDER } from "./application/ports/forecast/weather-provider.port.js";
import { WEATHER_REPORT_CACHE } from "./application/ports/forecast/weather-report.cache.port.js";
import { WEATHER_REPORT_PROVIDER } from "./application/ports/forecast/weather-report.provider.port.js";
import { WEATHER_REPORT_READER } from "./application/ports/forecast/weather-report.reader.port.js";
import { WeatherForecastReader } from "./application/services/forecast/weather-forecast.reader.js";
import { WeatherReportReader } from "./application/services/forecast/weather-report.reader.js";
import { GetWeatherConditions } from "./application/use-cases/forecast/get-weather-conditions.use-case.js";
import { GetWeatherForecast } from "./application/use-cases/forecast/get-weather-forecast.use-case.js";
import { GetWeatherReport } from "./application/use-cases/forecast/get-weather-report.use-case.js";
import { UpsertLocation } from "./application/use-cases/forecast/upsert-location.use-case.js";

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
