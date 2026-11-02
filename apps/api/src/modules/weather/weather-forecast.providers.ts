import {
  getWeatherConditionsProvider,
  getWeatherForecastProvider,
  getWeatherReportProvider,
  upsertLocationProvider,
} from "./weather-forecast-application.providers.js";

export const WEATHER_PROVIDERS = [
  getWeatherForecastProvider,
  getWeatherConditionsProvider,
  getWeatherReportProvider,
  upsertLocationProvider,
] as const;
