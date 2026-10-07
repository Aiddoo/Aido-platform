import {
  getWeatherConditionsProvider,
  getWeatherForecastProvider,
  upsertLocationProvider,
} from "./weather-forecast-application.providers.js";

export const WEATHER_PROVIDERS = [
  getWeatherForecastProvider,
  getWeatherConditionsProvider,
  upsertLocationProvider,
] as const;
