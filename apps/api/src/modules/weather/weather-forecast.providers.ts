import {
  getForecastsByGridBatchProvider,
  getWeatherConditionsProvider,
  getWeatherForecastProvider,
  upsertLocationProvider,
} from "./weather-forecast-application.providers.js";

export const WEATHER_PROVIDERS = [
  getWeatherForecastProvider,
  getWeatherConditionsProvider,
  getForecastsByGridBatchProvider,
  upsertLocationProvider,
] as const;
