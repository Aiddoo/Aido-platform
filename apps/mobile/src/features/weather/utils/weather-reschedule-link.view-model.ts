import { WEATHER_RESCHEDULE_DEEP_LINK } from '@aido/api/vocabulary';

import {
  type WeatherRescheduleParams,
  weatherRescheduleParamsSchema,
} from '../schemas/weather-reschedule-params.schema';

/** 옮기기 시트 경로. 시트가 읽는 형식으로 URL 값을 만든다. */
export function toWeatherRescheduleHref(params: WeatherRescheduleParams) {
  return {
    pathname: WEATHER_RESCHEDULE_DEEP_LINK,
    params: weatherRescheduleParamsSchema.encode(params),
  } as const;
}
