import {
  todoIdParamSchema,
  WEATHER_RESCHEDULE_DEEP_LINK,
  WEATHER_RESCHEDULE_MAX_TODO_IDS,
  WEATHER_RESCHEDULE_REASONS,
  type WeatherRescheduleReason,
} from '@aido/api';
import { routeIntegerStringSchema } from '@src/shared/utils/route-params';
import { z } from 'zod';

/** 경로만 오는 알림 링크를 표준 URL 파서로 읽기 위한 기준 주소. 호스트는 쓰지 않는다. */
const RELATIVE_URL_BASE = 'aido://app';

/** `?todoIds=12,15` — 비·더위와 겹쳐 옮길 할 일 id 목록 */
export const rescheduleTodoIdsParamSchema = z.object({
  todoIds: z
    .string()
    .transform((value) => value.split(','))
    .pipe(
      z
        .array(routeIntegerStringSchema.pipe(todoIdParamSchema.shape.id))
        .min(1)
        .max(WEATHER_RESCHEDULE_MAX_TODO_IDS),
    ),
});

/** `?reason=heat` — 무엇을 피해 옮길지. 없거나 낯선 값이면 기존 링크처럼 비를 피한다. */
export const rescheduleReasonParamSchema = z.object({
  reason: z.enum(WEATHER_RESCHEDULE_REASONS).catch('rain'),
});

export function toRescheduleTodoIdsParam(todoIds: readonly number[]): string {
  return todoIds.join(',');
}

export function createWeatherRescheduleHref(
  todoIds: readonly number[],
  reason: WeatherRescheduleReason = 'rain',
) {
  return {
    pathname: WEATHER_RESCHEDULE_DEEP_LINK,
    params: { todoIds: toRescheduleTodoIdsParam(todoIds), reason },
  } as const;
}

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
  const params = Object.fromEntries(parsed.searchParams);
  const todoIds = rescheduleTodoIdsParamSchema.safeParse(params);
  if (!todoIds.success) {
    return null;
  }
  return createWeatherRescheduleHref(
    todoIds.data.todoIds,
    rescheduleReasonParamSchema.parse(params).reason,
  );
}
