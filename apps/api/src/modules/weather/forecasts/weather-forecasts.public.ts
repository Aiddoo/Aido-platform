/** 다른 Context에는 예보 read model과 최소 배치 조회 capability만 공개한다. v1(KMA)은 AI 제안이, v2 리포트는 날씨 알림이 쓴다. */
export { WEATHER_FORECAST_READER } from "./application/ports/weather-forecast.reader.port.js";
export type {
  GridInput,
  WeatherForecastReaderPort,
} from "./application/ports/weather-forecast.reader.port.js";
export type { WeatherForecast } from "./application/ports/weather-forecast-provider.port.js";
export { WEATHER_REPORT_READER } from "./application/ports/weather-report.reader.port.js";
export type { WeatherReportReaderPort } from "./application/ports/weather-report.reader.port.js";
export { WeatherForecastModule } from "../weather.module.js";
