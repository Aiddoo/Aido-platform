import { Module } from "@nestjs/common";
import { HttpClientModule } from "@nestjs/http-client";

import { AIR_QUALITY_PROVIDER } from "./application/ports/forecast/air-quality-provider.port.js";
import { LIFESTYLE_INDEX_PROVIDER } from "./application/ports/forecast/lifestyle-index-provider.port.js";
import { SUN_TIME_PROVIDER } from "./application/ports/forecast/sun-time-provider.port.js";
import { WEATHER_CACHE } from "./application/ports/forecast/weather-cache.port.js";
import { WEATHER_FORECAST_READER } from "./application/ports/forecast/weather-forecast.reader.port.js";
import { WEATHER_GRID_RESOLVER } from "./application/ports/forecast/weather-grid-resolver.port.js";
import { WEATHER_LOCATION_REPOSITORY } from "./application/ports/forecast/weather-location.repository.port.js";
import { WEATHER_PROVIDER } from "./application/ports/forecast/weather-provider.port.js";
import { WeatherForecastReader } from "./application/services/forecast/weather-forecast.reader.js";
import { AirkoreaProvider } from "./infrastructure/adapters/forecast/airkorea.provider.js";
import { KasiSunTimeProvider } from "./infrastructure/adapters/forecast/kasi-sun-time.provider.js";
import { KmaLifestyleIndexProvider } from "./infrastructure/adapters/forecast/kma-lifestyle-index.provider.js";
import { KmaWeatherGridResolver } from "./infrastructure/adapters/forecast/kma-weather-grid.resolver.js";
import { KmaWeatherProvider } from "./infrastructure/adapters/forecast/kma-weather.provider.js";
import { WeatherCacheAdapter } from "./infrastructure/adapters/forecast/weather-cache.adapter.js";
import { PrismaWeatherLocationRepository } from "./infrastructure/persistence/forecast/prisma-weather-location.repository.js";
import { WeatherController } from "./presentation/controllers/forecast/weather.controller.js";
import { weatherForecastReaderProvider } from "./weather-forecast-application.providers.js";
import { WEATHER_PROVIDERS } from "./weather-forecast.providers.js";

/** 날씨 endpoint와 공급자·캐시·배치 조회의 명시적 조립. */
@Module({
  imports: [HttpClientModule.register({ name: "weather", retry: false, throwOnHttpError: false })],
  controllers: [WeatherController],
  providers: [
    { provide: WEATHER_FORECAST_READER, useExisting: WeatherForecastReader },
    { provide: WEATHER_GRID_RESOLVER, useClass: KmaWeatherGridResolver },
    weatherForecastReaderProvider,
    {
      provide: WEATHER_LOCATION_REPOSITORY,
      useClass: PrismaWeatherLocationRepository,
    },
    { provide: WEATHER_PROVIDER, useClass: KmaWeatherProvider },
    { provide: AIR_QUALITY_PROVIDER, useClass: AirkoreaProvider },
    { provide: LIFESTYLE_INDEX_PROVIDER, useClass: KmaLifestyleIndexProvider },
    { provide: SUN_TIME_PROVIDER, useClass: KasiSunTimeProvider },
    { provide: WEATHER_CACHE, useClass: WeatherCacheAdapter },
    ...WEATHER_PROVIDERS,
  ],
  exports: [WEATHER_FORECAST_READER],
})
export class WeatherForecastModule {}
