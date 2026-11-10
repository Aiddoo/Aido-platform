import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HttpClientModule } from "@nestjs/http-client";

import { PlanningTodoQueriesModule } from "#api/modules/planning/todos/planning-todo-queries.public";

import { WeatherLocationsModule } from "../locations/weather-locations.module.js";
import {
  WEATHER_FORECAST_READER,
  WeatherForecastReaderPort,
} from "./application/ports/weather-forecast.reader.port.js";
import { WeatherReportReaderPort } from "./application/ports/weather-report.reader.port.js";
import { WeatherController } from "./presentation/http/v1/weather.controller.js";
import { WeatherV2Controller } from "./presentation/http/v2/weather.controller.js";
import { weatherForecastsConfig } from "./weather-forecasts.config.js";
import { WEATHER_FORECASTS_PROVIDERS } from "./weather-forecasts.providers.js";

const WEATHER_VENDOR_TIMEOUT_MS = 10_000;

/** 날씨 endpoint와 공급자·캐시·배치 조회의 명시적 조립. */
@Module({
  imports: [
    ConfigModule.forFeature(weatherForecastsConfig),
    WeatherLocationsModule,
    PlanningTodoQueriesModule,
    HttpClientModule.register({
      name: "weather",
      retry: false,
      throwOnHttpError: false,
      timeout: WEATHER_VENDOR_TIMEOUT_MS,
    }),
  ],
  controllers: [WeatherController, WeatherV2Controller],
  providers: [...WEATHER_FORECASTS_PROVIDERS],
  exports: [WeatherForecastReaderPort, WeatherReportReaderPort, WEATHER_FORECAST_READER],
})
export class WeatherForecastsModule {}
