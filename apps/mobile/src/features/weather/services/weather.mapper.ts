import type { LocationResponse, WeatherForecastResponse } from '@aido/validators';

import type { HourlyForecast, Location, WeatherForecast } from '../models/weather.model';

export const toHourlyForecast = (
  dto: WeatherForecastResponse['hourlyForecasts'][number],
): HourlyForecast => ({
  hour: dto.hour,
  temperature: dto.temperature,
  skyCondition: dto.skyCondition,
  precipitationProbability: dto.precipitationProbability,
});

export const toWeatherForecast = (dto: WeatherForecastResponse): WeatherForecast => ({
  date: new Date(dto.date),
  skyCondition: dto.skyCondition,
  precipitationType: dto.precipitationType,
  precipitationProbability: dto.precipitationProbability,
  temperatureMin: dto.temperatureMin,
  temperatureMax: dto.temperatureMax,
  humidity: dto.humidity,
  windSpeed: dto.windSpeed,
  hourlyForecasts: dto.hourlyForecasts.map(toHourlyForecast),
});

export const toLocation = (dto: LocationResponse): Location => ({
  latitude: dto.latitude,
  longitude: dto.longitude,
  gridX: dto.gridX,
  gridY: dto.gridY,
});
