import { z } from 'zod';

import type { CurrentWeather } from './weather-report.schema';

export const weatherReportQueryKeySchema = z.object({ locationRevision: z.number() });
export type WeatherReportQueryKey = z.infer<typeof weatherReportQueryKeySchema> & {
  devOverride?: Pick<CurrentWeather, 'condition' | 'isDaylight'>;
};
