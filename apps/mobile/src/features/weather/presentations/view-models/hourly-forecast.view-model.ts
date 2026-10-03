import { z } from 'zod';

import { type HourlyForecast, hourlyForecastSchema } from '../../models/weather.model';

const hourlyForecastViewModelSchema = hourlyForecastSchema.extend({
  id: z.string(),
  dayOffset: z.number().int().min(0),
});
export type HourlyForecastViewModel = z.infer<typeof hourlyForecastViewModelSchema>;

export function toUpcomingHourlyForecasts(
  forecasts: readonly HourlyForecast[],
  currentHour: number,
): HourlyForecastViewModel[] {
  let dayOffset = 0;
  let previousHour = -1;

  return forecasts.flatMap((forecast) => {
    if (forecast.hour < previousHour) dayOffset += 1;
    previousHour = forecast.hour;

    if (dayOffset === 0 && forecast.hour < currentHour) return [];

    return [{ ...forecast, id: `${dayOffset}-${forecast.hour}`, dayOffset }];
  });
}
