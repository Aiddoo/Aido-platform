import { Module } from "@nestjs/common";
import { HttpClientModule } from "@nestjs/http-client";

import { AIR_QUALITY_PROVIDER } from "./forecasts/application/ports/air-quality-provider.port.js";
import { LIFESTYLE_INDEX_PROVIDER } from "./forecasts/application/ports/lifestyle-index-provider.port.js";
import { SUN_TIME_PROVIDER } from "./forecasts/application/ports/sun-time-provider.port.js";
import { WEATHER_CACHE } from "./forecasts/application/ports/weather-forecast-cache.port.js";
import { WEATHER_PROVIDER } from "./forecasts/application/ports/weather-forecast-provider.port.js";
import { WEATHER_FORECAST_READER } from "./forecasts/application/ports/weather-forecast.reader.port.js";
import { WEATHER_REPORT_CACHE } from "./forecasts/application/ports/weather-report-cache.port.js";
import { WEATHER_REPORT_PROVIDER } from "./forecasts/application/ports/weather-report-provider.port.js";
import { WEATHER_REPORT_READER } from "./forecasts/application/ports/weather-report.reader.port.js";
import { WeatherForecastReader } from "./forecasts/application/weather-forecast.reader.js";
import { WeatherReportReader } from "./forecasts/application/weather-report.reader.js";
import { AirkoreaAirQualityAdapter } from "./forecasts/infrastructure/adapters/airkorea-air-quality.adapter.js";
import { KasiSunTimeAdapter } from "./forecasts/infrastructure/adapters/kasi-sun-time.adapter.js";
import { KmaLifestyleIndexAdapter } from "./forecasts/infrastructure/adapters/kma-lifestyle-index.adapter.js";
import { KmaWeatherForecastAdapter } from "./forecasts/infrastructure/adapters/kma-weather-forecast.adapter.js";
import { WeatherKitAttributionAdapter } from "./forecasts/infrastructure/adapters/weatherkit-attribution.adapter.js";
import { WeatherKitReportAdapter } from "./forecasts/infrastructure/adapters/weatherkit-report.adapter.js";
import { WeatherKitTokenAdapter } from "./forecasts/infrastructure/adapters/weatherkit-token.adapter.js";
import { WeatherKitUsageMeterAdapter } from "./forecasts/infrastructure/adapters/weatherkit-usage-meter.adapter.js";
import { WeatherForecastCache } from "./forecasts/infrastructure/cache/weather-forecast.cache.js";
import { WeatherReportCache } from "./forecasts/infrastructure/cache/weather-report.cache.js";
import { WeatherController } from "./forecasts/presentation/http/v1/weather.controller.js";
import { WeatherV2Controller } from "./forecasts/presentation/http/v2/weather.controller.js";
import { TIMEZONE_RESOLVER } from "./locations/application/ports/timezone-resolver.port.js";
import { WEATHER_LOCATION_REPOSITORY } from "./locations/application/ports/user-location.repository.port.js";
import { WEATHER_GRID_RESOLVER } from "./locations/application/ports/weather-grid-resolver.port.js";
import { KmaWeatherGridResolverAdapter } from "./locations/infrastructure/adapters/kma-weather-grid-resolver.adapter.js";
import { TzLookupTimezoneResolverAdapter } from "./locations/infrastructure/adapters/tz-lookup-timezone-resolver.adapter.js";
import { DrizzleUserLocationRepository } from "./locations/infrastructure/persistence/drizzle-user-location.repository.js";
import { WeatherLocationController } from "./locations/presentation/http/v1/weather-location.controller.js";
import { WeatherLocationV2Controller } from "./locations/presentation/http/v2/weather-location.controller.js";
import {
  weatherForecastReaderProvider,
  weatherReportReaderProvider,
} from "./weather-application.providers.js";
import { WEATHER_PROVIDERS } from "./weather.providers.js";

const WEATHER_VENDOR_TIMEOUT_MS = 10_000;

/** 날씨 endpoint와 공급자·캐시·배치 조회의 명시적 조립. */
@Module({
  imports: [
    HttpClientModule.register({
      name: "weather",
      retry: false,
      throwOnHttpError: false,
      timeout: WEATHER_VENDOR_TIMEOUT_MS,
    }),
  ],
  controllers: [
    WeatherController,
    WeatherLocationController,
    WeatherV2Controller,
    WeatherLocationV2Controller,
  ],
  providers: [
    { provide: WEATHER_FORECAST_READER, useExisting: WeatherForecastReader },
    { provide: WEATHER_GRID_RESOLVER, useClass: KmaWeatherGridResolverAdapter },
    weatherForecastReaderProvider,
    { provide: WEATHER_REPORT_READER, useExisting: WeatherReportReader },
    weatherReportReaderProvider,
    {
      provide: WEATHER_LOCATION_REPOSITORY,
      useClass: DrizzleUserLocationRepository,
    },
    { provide: WEATHER_PROVIDER, useClass: KmaWeatherForecastAdapter },
    { provide: AIR_QUALITY_PROVIDER, useClass: AirkoreaAirQualityAdapter },
    { provide: LIFESTYLE_INDEX_PROVIDER, useClass: KmaLifestyleIndexAdapter },
    { provide: SUN_TIME_PROVIDER, useClass: KasiSunTimeAdapter },
    { provide: WEATHER_CACHE, useClass: WeatherForecastCache },
    WeatherKitTokenAdapter,
    WeatherKitAttributionAdapter,
    WeatherKitUsageMeterAdapter,
    { provide: WEATHER_REPORT_PROVIDER, useClass: WeatherKitReportAdapter },
    { provide: WEATHER_REPORT_CACHE, useClass: WeatherReportCache },
    { provide: TIMEZONE_RESOLVER, useClass: TzLookupTimezoneResolverAdapter },
    ...WEATHER_PROVIDERS,
  ],
  exports: [WEATHER_FORECAST_READER, WEATHER_REPORT_READER],
})
export class WeatherForecastModule {}
