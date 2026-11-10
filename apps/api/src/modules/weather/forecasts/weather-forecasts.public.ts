/**
 * 다른 Context에는 예보 read model과 최소 배치 조회 capability만 공개한다.
 * v1(KMA)은 AI 제안이, v2 리포트는 날씨 알림이 쓴다.
 * Symbol 토큰은 소비 Context가 클래스 토큰으로 옮길 때까지 같은 인스턴스를 가리키는 별칭이다.
 */
export {
  WEATHER_FORECAST_READER,
  WeatherForecastReaderPort,
} from "./application/ports/weather-forecast.reader.port.js";
export type { GridInput } from "./application/ports/weather-forecast.reader.port.js";
export {
  WEATHER_REPORT_READER,
  WeatherReportReaderPort,
} from "./application/ports/weather-report.reader.port.js";
export type {
  LocatedWeatherReport,
  WeatherReportReadRequest,
} from "./application/ports/weather-report.reader.port.js";
export type { WeatherForecast } from "./application/read-models/weather-forecast.read-model.js";
export { WeatherForecastsModule } from "./weather-forecasts.module.js";
