import {
  type HourlyForecast,
  type WeatherForecast,
  WeatherPolicy,
} from '../../models/weather.model';

export interface WeatherForecastViewModel extends WeatherForecast {
  currentTemperature: number;
}

const findExactHourlyForecast = (hourlyForecasts: HourlyForecast[], hour: number) =>
  hourlyForecasts.find((h) => h.hour === hour);

const findClosestHourlyForecast = (hourlyForecasts: HourlyForecast[], hour: number) =>
  hourlyForecasts.reduce((prev, curr) =>
    Math.abs(curr.hour - hour) < Math.abs(prev.hour - hour) ? curr : prev,
  );

const getCurrentTemperature = (forecast: WeatherForecast, currentHour: number): number => {
  if (!WeatherPolicy.hasHourlyForecasts(forecast)) {
    return Math.round((forecast.temperatureMin + forecast.temperatureMax) / 2);
  }

  const hourly =
    findExactHourlyForecast(forecast.hourlyForecasts, currentHour) ??
    findClosestHourlyForecast(forecast.hourlyForecasts, currentHour);

  return Math.round(hourly.temperature);
};

export const toWeatherForecastViewModel = (
  forecast: WeatherForecast,
  currentHour: number,
): WeatherForecastViewModel => ({
  ...forecast,
  currentTemperature: getCurrentTemperature(forecast, currentHour),
});
