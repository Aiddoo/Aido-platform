import { Module } from "@nestjs/common";
import { HttpClientModule } from "@nestjs/http-client";

import { AIR_QUALITY_PROVIDER } from "./application/ports/forecast/air-quality-provider.port.js";
import { LIFESTYLE_INDEX_PROVIDER } from "./application/ports/forecast/lifestyle-index-provider.port.js";
import { SUN_TIME_PROVIDER } from "./application/ports/forecast/sun-time-provider.port.js";
import { TIMEZONE_RESOLVER } from "./application/ports/forecast/timezone.resolver.port.js";
import { WEATHER_CACHE } from "./application/ports/forecast/weather-cache.port.js";
import { WEATHER_FORECAST_READER } from "./application/ports/forecast/weather-forecast.reader.port.js";
import { WEATHER_GRID_RESOLVER } from "./application/ports/forecast/weather-grid-resolver.port.js";
import { WEATHER_LOCATION_REPOSITORY } from "./application/ports/forecast/weather-location.repository.port.js";
import { WEATHER_PROVIDER } from "./application/ports/forecast/weather-provider.port.js";
import { WEATHER_REPORT_CACHE } from "./application/ports/forecast/weather-report.cache.port.js";
import { WEATHER_REPORT_PROVIDER } from "./application/ports/forecast/weather-report.provider.port.js";
import { WEATHER_REPORT_READER } from "./application/ports/forecast/weather-report.reader.port.js";
import { WeatherForecastReader } from "./application/services/forecast/weather-forecast.reader.js";
import { WeatherReportReader } from "./application/services/forecast/weather-report.reader.js";
import { AirkoreaProvider } from "./infrastructure/adapters/forecast/airkorea.provider.js";
import { KasiSunTimeProvider } from "./infrastructure/adapters/forecast/kasi-sun-time.provider.js";
import { KmaLifestyleIndexProvider } from "./infrastructure/adapters/forecast/kma-lifestyle-index.provider.js";
import { KmaWeatherGridResolver } from "./infrastructure/adapters/forecast/kma-weather-grid.resolver.js";
import { KmaWeatherProvider } from "./infrastructure/adapters/forecast/kma-weather.provider.js";
import { TzLookupTimezoneResolver } from "./infrastructure/adapters/forecast/tz-lookup-timezone.resolver.js";
import { WeatherCacheAdapter } from "./infrastructure/adapters/forecast/weather-cache.adapter.js";
import { WeatherReportCacheAdapter } from "./infrastructure/adapters/forecast/weather-report-cache.adapter.js";
import { WeatherKitAttributionResolver } from "./infrastructure/adapters/forecast/weatherkit-attribution.resolver.js";
import { WeatherKitOutageCircuit } from "./infrastructure/adapters/forecast/weatherkit-outage.circuit.js";
import { WeatherKitReportProvider } from "./infrastructure/adapters/forecast/weatherkit-report.provider.js";
import { WeatherKitTokenResolver } from "./infrastructure/adapters/forecast/weatherkit-token.resolver.js";
import { DrizzleWeatherLocationRepository } from "./infrastructure/persistence/forecast/drizzle-weather-location.repository.js";
import { WeatherController } from "./presentation/controllers/forecast/v1/weather.controller.js";
import { WeatherV2Controller } from "./presentation/controllers/forecast/v2/weather.controller.js";
import {
  weatherForecastReaderProvider,
  weatherReportReaderProvider,
} from "./weather-forecast-application.providers.js";
import { WEATHER_PROVIDERS } from "./weather-forecast.providers.js";

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
  controllers: [WeatherController, WeatherV2Controller],
  providers: [
    { provide: WEATHER_FORECAST_READER, useExisting: WeatherForecastReader },
    { provide: WEATHER_GRID_RESOLVER, useClass: KmaWeatherGridResolver },
    weatherForecastReaderProvider,
    { provide: WEATHER_REPORT_READER, useExisting: WeatherReportReader },
    weatherReportReaderProvider,
    {
      provide: WEATHER_LOCATION_REPOSITORY,
      useClass: DrizzleWeatherLocationRepository,
    },
    { provide: WEATHER_PROVIDER, useClass: KmaWeatherProvider },
    { provide: AIR_QUALITY_PROVIDER, useClass: AirkoreaProvider },
    { provide: LIFESTYLE_INDEX_PROVIDER, useClass: KmaLifestyleIndexProvider },
    { provide: SUN_TIME_PROVIDER, useClass: KasiSunTimeProvider },
    { provide: WEATHER_CACHE, useClass: WeatherCacheAdapter },
    WeatherKitTokenResolver,
    WeatherKitAttributionResolver,
    WeatherKitOutageCircuit,
    { provide: WEATHER_REPORT_PROVIDER, useClass: WeatherKitReportProvider },
    { provide: WEATHER_REPORT_CACHE, useClass: WeatherReportCacheAdapter },
    { provide: TIMEZONE_RESOLVER, useClass: TzLookupTimezoneResolver },
    ...WEATHER_PROVIDERS,
  ],
  exports: [WEATHER_FORECAST_READER, WEATHER_REPORT_READER],
})
export class WeatherForecastModule {}
