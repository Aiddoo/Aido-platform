import { Logger, type FactoryProvider } from "@nestjs/common";

import { AIR_QUALITY_PROVIDER } from "./forecasts/application/ports/air-quality-provider.port.js";
import { LIFESTYLE_INDEX_PROVIDER } from "./forecasts/application/ports/lifestyle-index-provider.port.js";
import { SUN_TIME_PROVIDER } from "./forecasts/application/ports/sun-time-provider.port.js";
import { WEATHER_CACHE } from "./forecasts/application/ports/weather-forecast-cache.port.js";
import { WEATHER_PROVIDER } from "./forecasts/application/ports/weather-forecast-provider.port.js";
import { WEATHER_REPORT_CACHE } from "./forecasts/application/ports/weather-report-cache.port.js";
import { WEATHER_REPORT_PROVIDER } from "./forecasts/application/ports/weather-report-provider.port.js";
import { WEATHER_REPORT_READER } from "./forecasts/application/ports/weather-report.reader.port.js";
import { GetWeatherConditionsUseCase } from "./forecasts/application/use-cases/get-weather-conditions.use-case.js";
import { GetWeatherForecastUseCase } from "./forecasts/application/use-cases/get-weather-forecast.use-case.js";
import { GetWeatherReportUseCase } from "./forecasts/application/use-cases/get-weather-report.use-case.js";
import { WeatherForecastReader } from "./forecasts/application/weather-forecast.reader.js";
import { WeatherReportReader } from "./forecasts/application/weather-report.reader.js";
import { TIMEZONE_RESOLVER } from "./locations/application/ports/timezone-resolver.port.js";
import { WEATHER_LOCATION_REPOSITORY } from "./locations/application/ports/user-location.repository.port.js";
import { WEATHER_GRID_RESOLVER } from "./locations/application/ports/weather-grid-resolver.port.js";
import { UpsertUserLocationUseCase } from "./locations/application/use-cases/upsert-user-location.use-case.js";

export const getWeatherConditionsProvider: FactoryProvider<GetWeatherConditionsUseCase> = {
  provide: GetWeatherConditionsUseCase,
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
      typeof GetWeatherConditionsUseCase
    >[0]["weatherLocationRepository"],
    airQualityProvider: ConstructorParameters<
      typeof GetWeatherConditionsUseCase
    >[0]["airQualityProvider"],
    lifestyleIndexProvider: ConstructorParameters<
      typeof GetWeatherConditionsUseCase
    >[0]["lifestyleIndexProvider"],
    sunTimeProvider: ConstructorParameters<
      typeof GetWeatherConditionsUseCase
    >[0]["sunTimeProvider"],
    weatherProvider: ConstructorParameters<
      typeof GetWeatherConditionsUseCase
    >[0]["weatherProvider"],
    forecastReader: ConstructorParameters<typeof GetWeatherConditionsUseCase>[0]["forecastReader"],
    weatherCache: ConstructorParameters<typeof GetWeatherConditionsUseCase>[0]["weatherCache"],
  ) =>
    new GetWeatherConditionsUseCase({
      weatherLocationRepository,
      airQualityProvider,
      lifestyleIndexProvider,
      sunTimeProvider,
      weatherProvider,
      forecastReader,
      weatherCache,
      logger: new Logger(GetWeatherConditionsUseCase.name),
    }),
};

export const getWeatherForecastProvider: FactoryProvider<GetWeatherForecastUseCase> = {
  provide: GetWeatherForecastUseCase,
  inject: [WEATHER_LOCATION_REPOSITORY, WeatherForecastReader],
  useFactory: (
    weatherLocationRepository: ConstructorParameters<
      typeof GetWeatherForecastUseCase
    >[0]["weatherLocationRepository"],
    forecastReader: ConstructorParameters<typeof GetWeatherForecastUseCase>[0]["forecastReader"],
  ) => new GetWeatherForecastUseCase({ weatherLocationRepository, forecastReader }),
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

export const upsertLocationProvider: FactoryProvider<UpsertUserLocationUseCase> = {
  provide: UpsertUserLocationUseCase,
  inject: [WEATHER_LOCATION_REPOSITORY, WEATHER_CACHE, WEATHER_GRID_RESOLVER, TIMEZONE_RESOLVER],
  useFactory: (
    weatherLocationRepository: ConstructorParameters<
      typeof UpsertUserLocationUseCase
    >[0]["weatherLocationRepository"],
    weatherCache: ConstructorParameters<typeof UpsertUserLocationUseCase>[0]["weatherCache"],
    weatherGridResolver: ConstructorParameters<
      typeof UpsertUserLocationUseCase
    >[0]["weatherGridResolver"],
    timezoneResolver: ConstructorParameters<
      typeof UpsertUserLocationUseCase
    >[0]["timezoneResolver"],
  ) =>
    new UpsertUserLocationUseCase({
      weatherLocationRepository,
      weatherCache,
      weatherGridResolver,
      timezoneResolver,
    }),
};

export const getWeatherReportProvider: FactoryProvider<GetWeatherReportUseCase> = {
  provide: GetWeatherReportUseCase,
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
      typeof GetWeatherReportUseCase
    >[0]["weatherLocationRepository"],
    weatherReportReader: ConstructorParameters<
      typeof GetWeatherReportUseCase
    >[0]["weatherReportReader"],
    weatherReportProvider: ConstructorParameters<
      typeof GetWeatherReportUseCase
    >[0]["weatherReportProvider"],
    weatherReportCache: ConstructorParameters<
      typeof GetWeatherReportUseCase
    >[0]["weatherReportCache"],
    timezoneResolver: ConstructorParameters<typeof GetWeatherReportUseCase>[0]["timezoneResolver"],
    airQualityProvider: ConstructorParameters<
      typeof GetWeatherReportUseCase
    >[0]["airQualityProvider"],
  ) =>
    new GetWeatherReportUseCase({
      weatherLocationRepository,
      weatherReportReader,
      weatherReportProvider,
      weatherReportCache,
      timezoneResolver,
      airQualityProvider,
      logger: new Logger(GetWeatherReportUseCase.name),
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
