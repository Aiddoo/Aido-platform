import type { Provider } from "@nestjs/common";

import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import { TimezoneResolverPort } from "../locations/application/ports/timezone-resolver.port.js";
import { UserLocationRepositoryPort } from "../locations/application/ports/user-location.repository.port.js";
import { AirQualityProviderPort } from "./application/ports/air-quality-provider.port.js";
import { LifestyleIndexProviderPort } from "./application/ports/lifestyle-index-provider.port.js";
import { ScheduledTodoReaderPort } from "./application/ports/scheduled-todo.reader.port.js";
import { SunTimeProviderPort } from "./application/ports/sun-time-provider.port.js";
import { WeatherForecastCachePort } from "./application/ports/weather-forecast-cache.port.js";
import { WeatherForecastProviderPort } from "./application/ports/weather-forecast-provider.port.js";
import { WeatherForecastReaderPort } from "./application/ports/weather-forecast.reader.port.js";
import { WeatherReportCachePort } from "./application/ports/weather-report-cache.port.js";
import { WeatherReportProviderPort } from "./application/ports/weather-report-provider.port.js";
import { WeatherReportReaderPort } from "./application/ports/weather-report.reader.port.js";
import { GetWeatherConditionsUseCase } from "./application/use-cases/get-weather-conditions.use-case.js";
import { GetWeatherForecastUseCase } from "./application/use-cases/get-weather-forecast.use-case.js";
import { GetWeatherReportUseCase } from "./application/use-cases/get-weather-report.use-case.js";
import { WeatherForecastReader } from "./application/weather-forecast.reader.js";
import { WeatherReportReader } from "./application/weather-report.reader.js";
import { AirkoreaAirQualityAdapter } from "./infrastructure/adapters/airkorea-air-quality.adapter.js";
import { KasiSunTimeAdapter } from "./infrastructure/adapters/kasi-sun-time.adapter.js";
import { KmaLifestyleIndexAdapter } from "./infrastructure/adapters/kma-lifestyle-index.adapter.js";
import { KmaWeatherForecastAdapter } from "./infrastructure/adapters/kma-weather-forecast.adapter.js";
import { PlanningScheduledTodoAdapter } from "./infrastructure/adapters/planning-scheduled-todo.adapter.js";
import { WeatherKitAttributionAdapter } from "./infrastructure/adapters/weatherkit-attribution.adapter.js";
import { WeatherKitReportAdapter } from "./infrastructure/adapters/weatherkit-report.adapter.js";
import { WeatherKitTokenAdapter } from "./infrastructure/adapters/weatherkit-token.adapter.js";
import { WeatherKitUsageMeterAdapter } from "./infrastructure/adapters/weatherkit-usage-meter.adapter.js";
import { WeatherForecastCache } from "./infrastructure/cache/weather-forecast.cache.js";
import { WeatherReportCache } from "./infrastructure/cache/weather-report.cache.js";

export const WEATHER_FORECASTS_PROVIDERS = [
  { provide: WeatherForecastProviderPort, useClass: KmaWeatherForecastAdapter },
  { provide: AirQualityProviderPort, useClass: AirkoreaAirQualityAdapter },
  { provide: LifestyleIndexProviderPort, useClass: KmaLifestyleIndexAdapter },
  { provide: SunTimeProviderPort, useClass: KasiSunTimeAdapter },
  { provide: WeatherForecastCachePort, useClass: WeatherForecastCache },
  WeatherKitTokenAdapter,
  WeatherKitAttributionAdapter,
  WeatherKitUsageMeterAdapter,
  { provide: WeatherReportProviderPort, useClass: WeatherKitReportAdapter },
  { provide: WeatherReportCachePort, useClass: WeatherReportCache },
  { provide: ScheduledTodoReaderPort, useClass: PlanningScheduledTodoAdapter },
  provideUseCase(WeatherForecastReader, {
    weatherProvider: WeatherForecastProviderPort,
    weatherCache: WeatherForecastCachePort,
    logger: loggerFor(WeatherForecastReader),
    clock: ClockPort,
  }),
  provideUseCase(WeatherReportReader, {
    weatherReportProvider: WeatherReportProviderPort,
    weatherReportCache: WeatherReportCachePort,
    timezoneResolver: TimezoneResolverPort,
    logger: loggerFor(WeatherReportReader),
  }),
  { provide: WeatherForecastReaderPort, useExisting: WeatherForecastReader },
  { provide: WeatherReportReaderPort, useExisting: WeatherReportReader },
  provideUseCase(GetWeatherForecastUseCase, {
    userLocationRepository: UserLocationRepositoryPort,
    forecastReader: WeatherForecastReader,
  }),
  provideUseCase(GetWeatherConditionsUseCase, {
    userLocationRepository: UserLocationRepositoryPort,
    airQualityProvider: AirQualityProviderPort,
    lifestyleIndexProvider: LifestyleIndexProviderPort,
    sunTimeProvider: SunTimeProviderPort,
    forecastReader: WeatherForecastReader,
    weatherProvider: WeatherForecastProviderPort,
    weatherCache: WeatherForecastCachePort,
    logger: loggerFor(GetWeatherConditionsUseCase),
  }),
  provideUseCase(GetWeatherReportUseCase, {
    userLocationRepository: UserLocationRepositoryPort,
    weatherReportReader: WeatherReportReaderPort,
    weatherReportProvider: WeatherReportProviderPort,
    weatherReportCache: WeatherReportCachePort,
    timezoneResolver: TimezoneResolverPort,
    airQualityProvider: AirQualityProviderPort,
    scheduledTodoReader: ScheduledTodoReaderPort,
    logger: loggerFor(GetWeatherReportUseCase),
    clock: ClockPort,
  }),
] satisfies Provider[];
