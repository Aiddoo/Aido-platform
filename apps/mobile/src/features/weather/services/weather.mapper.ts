import type {
  LocationResponse,
  WeatherConditions as WeatherConditionsDTO,
  WeatherForecastResponse,
} from '@aido/validators';

import type {
  DailyForecast,
  HourlyForecast,
  Location,
  WeatherConditions,
  WeatherForecast,
} from '../models/weather.model';

export const toHourlyForecast = (
  dto: WeatherForecastResponse['hourlyForecasts'][number],
): HourlyForecast => ({
  hour: dto.hour,
  temperature: dto.temperature,
  skyCondition: dto.skyCondition,
  precipitationProbability: dto.precipitationProbability,
  precipitationAmount: dto.precipitationAmount,
  snowAmount: dto.snowAmount,
});

export const toDailyForecast = (
  dto: WeatherForecastResponse['dailyForecasts'][number],
): DailyForecast => ({
  date: dto.date,
  skyCondition: dto.skyCondition,
  precipitationType: dto.precipitationType,
  precipitationProbability: dto.precipitationProbability,
  temperatureMin: dto.temperatureMin,
  temperatureMax: dto.temperatureMax,
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
  dailyForecasts: dto.dailyForecasts?.map(toDailyForecast) ?? [],
});

export const toWeatherConditions = (dto: WeatherConditionsDTO): WeatherConditions => ({
  feelsLikeTemperature: dto.feelsLikeTemperature,
  sunrise: dto.sunrise,
  sunset: dto.sunset,
  pm10: dto.pm10,
  pm25: dto.pm25,
});

export const toLocation = (dto: LocationResponse): Location => ({
  latitude: dto.latitude,
  longitude: dto.longitude,
  gridX: dto.gridX,
  gridY: dto.gridY,
});
