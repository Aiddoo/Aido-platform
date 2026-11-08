import { WEATHER_RESCHEDULE_DEEP_LINK } from '@aido/api/vocabulary';

import {
  type WeatherRescheduleParams,
  weatherRescheduleParamsSchema,
} from '../schemas/weather-reschedule-params.schema';

/** 경로만 오는 알림 링크를 표준 URL 파서로 읽기 위한 기준 주소. 호스트는 쓰지 않는다. */
const RELATIVE_URL_BASE = 'aido://app';

function parseRelativeUrl(url: string): URL | null {
  try {
    return new URL(url, RELATIVE_URL_BASE);
  } catch {
    return null;
  }
}

export function parseWeatherRescheduleUrl(url: string | undefined) {
  if (url == null || !url.startsWith('/')) {
    return null;
  }
  const parsed = parseRelativeUrl(url);
  if (parsed?.pathname !== WEATHER_RESCHEDULE_DEEP_LINK) {
    return null;
  }
  const params = weatherRescheduleParamsSchema.safeParse(Object.fromEntries(parsed.searchParams));
  if (!params.success) {
    return null;
  }
  return toWeatherRescheduleHref(params.data);
}

export function toWeatherRescheduleHref(params: WeatherRescheduleParams) {
  return {
    pathname: WEATHER_RESCHEDULE_DEEP_LINK,
    params: weatherRescheduleParamsSchema.encode(params),
  } as const;
}
