import type { WeatherForecastResponse } from "@aido/api/contracts/weather";

import { toIsoString } from "#api/shared/domain/time/instant";

import type { WeatherForecastWithLocation } from "../../../application/use-cases/get-weather-forecast.use-case.js";

export function toWeatherForecastResponse({
  forecast,
  location,
}: WeatherForecastWithLocation): WeatherForecastResponse {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    ...forecast,
    date: toIsoString(forecast.date),
    hourlyForecasts: [...forecast.hourlyForecasts],
    dailyForecasts: [...forecast.dailyForecasts],
  };
}
