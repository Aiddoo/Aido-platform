export { WeatherReportReaderPort } from "./application/ports/weather-report.reader.port.js";
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
