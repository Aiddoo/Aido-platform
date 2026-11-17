import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HttpClientModule } from "@nestjs/http-client";

import { PlanningTodoQueriesModule } from "#api/modules/planning/todos/planning-todo-queries.public";

import { WeatherUserLocationsModule } from "../user-locations/weather-user-locations.module.js";
import { WeatherReportReaderPort } from "./application/ports/weather-report.reader.port.js";
import { WeatherForecastController } from "./presentation/http/v1/weather-forecast.controller.js";
import { WeatherReportController } from "./presentation/http/v2/weather-report.controller.js";
import { weatherWeatherReportsConfig } from "./weather-weather-reports.config.js";
import { WEATHER_WEATHER_REPORTS_PROVIDERS } from "./weather-weather-reports.providers.js";

const WEATHER_VENDOR_TIMEOUT_MS = 10_000;

/** 날씨 endpoint와 공급자·캐시·배치 조회의 명시적 조립. */
@Module({
  imports: [
    ConfigModule.forFeature(weatherWeatherReportsConfig),
    WeatherUserLocationsModule,
    PlanningTodoQueriesModule,
    HttpClientModule.register({
      name: "weather",
      retry: false,
      throwOnHttpError: false,
      timeout: WEATHER_VENDOR_TIMEOUT_MS,
    }),
  ],
  controllers: [WeatherForecastController, WeatherReportController],
  providers: [...WEATHER_WEATHER_REPORTS_PROVIDERS],
  exports: [WeatherReportReaderPort],
})
export class WeatherWeatherReportsModule {}
