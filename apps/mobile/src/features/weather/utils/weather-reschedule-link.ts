import { WEATHER_RESCHEDULE_DEEP_LINK } from '@aido/api/vocabulary';
import { z } from 'zod';

import { weatherRescheduleParamsSchema } from '../schemas/weather-reschedule-params.schema';

/** 경로만 오는 알림 링크를 표준 URL 파서로 읽기 위한 기준 주소. 호스트는 쓰지 않는다. */
const RELATIVE_URL_BASE = 'aido://app';

function parseRelativeUrl(url: string): URL | null {
  try {
    return new URL(url, RELATIVE_URL_BASE);
  } catch {
    return null;
  }
}

/** 날씨 알림이 싣는 `/weather/reschedule?todoIds=…&reason=…` 링크를 읽는다. 다른 경로·잘못된 값이면 null이다. */
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

/** 옮기기 시트 경로. 읽을 때와 같은 형식으로 URL 값을 만든다. */
export function toWeatherRescheduleHref(params: z.output<typeof weatherRescheduleParamsSchema>) {
  return {
    pathname: WEATHER_RESCHEDULE_DEEP_LINK,
    params: z.encode(weatherRescheduleParamsSchema, params),
  } as const;
}
