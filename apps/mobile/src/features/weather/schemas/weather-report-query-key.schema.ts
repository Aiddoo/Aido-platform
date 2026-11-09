import { z } from 'zod';

import type { CurrentWeather } from '../domains/weather-report.model';

export const weatherReportQueryKeySchema = z.object({ locationRevision: z.number() });
export type WeatherReportQueryKey = z.infer<typeof weatherReportQueryKeySchema> & {
  devOverride?: Pick<CurrentWeather, 'condition' | 'isDaylight'>;
};
