import { minBy } from 'es-toolkit';
import { z } from 'zod';

import { type WeatherForecast, weatherForecastSchema } from '../../models/weather.model';

const weatherForecastViewModelSchema = weatherForecastSchema.extend({
  currentTemperature: z.number().nullable(),
});
export type WeatherForecastViewModel = z.infer<typeof weatherForecastViewModelSchema>;

export const toWeatherForecastViewModel = (
  forecast: WeatherForecast,
  currentHour: number,
): WeatherForecastViewModel => {
  const hourly =
    forecast.hourlyForecasts.find((item) => item.hour === currentHour) ??
    minBy(forecast.hourlyForecasts, (item) => Math.abs(item.hour - currentHour));
  return { ...forecast, currentTemperature: hourly ? Math.round(hourly.temperature) : null };
};
