/**
 * 다른 Context에는 예보 read model과 묶음 조회 포트만 연다.
 * v1 격자 예보는 AI 제안이, v2 리포트는 날씨 알림이 쓴다.
 */
export { WeatherForecastReaderPort } from "./application/ports/weather-forecast.reader.port.js";
export type { GridInput } from "./application/ports/weather-forecast.reader.port.js";
export { WeatherReportReaderPort } from "./application/ports/weather-report.reader.port.js";
export type { WeatherForecast } from "./application/read-models/weather-forecast.read-model.js";
// 날씨 알림 내용도 날씨 화면 브리핑과 같은 판단(planWeatherBriefing)에서 나온다
export {
  decideEveningWeatherBriefing,
  decideMorningWeatherBriefing,
  type EveningWeatherBriefing,
  type MorningWeatherBriefing,
  type WeatherBriefingDay,
  type WeatherBriefingForecast,
  type WeatherDayPart,
} from "./domain/weather-notification-briefing.domain-service.js";
export { WeatherForecastsModule } from "./weather-forecasts.module.js";
