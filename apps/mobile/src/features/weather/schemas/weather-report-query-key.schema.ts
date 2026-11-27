import { z } from 'zod';

import type { CurrentWeather } from '../domains/current-weather.model';

/** 개발 QA로 바꿔 보는 지금 날씨. 운영 키에는 없다 */
export type WeatherDevOverride = Pick<CurrentWeather, 'condition' | 'isDaylight'>;

export const weatherReportQueryKeySchema = z.object({ locationRevision: z.number() });
export type WeatherReportQueryKey = z.infer<typeof weatherReportQueryKeySchema> & {
  devOverride?: WeatherDevOverride;
};
