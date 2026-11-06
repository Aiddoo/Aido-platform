import { WEATHER_RESCHEDULE_MAX_TODO_IDS, WEATHER_RESCHEDULE_REASONS } from '@aido/api';
import { routeIdSchema } from '@src/shared/utils/route-params';
import { z } from 'zod';

/**
 * 날씨 옮기기 시트의 URL 값. 읽을 때와 쓸 때가 같은 형식이도록 한 곳에서 맡는다.
 * `?todoIds=12,15` 비·더위와 겹쳐 옮길 할 일 id 목록, `?reason=heat` 무엇을 피해 옮길지다.
 * reason이 없거나 낯선 값이면 기존 링크처럼 비를 피한다.
 */
export const weatherRescheduleParamsSchema = z.object({
  todoIds: z.codec(z.string(), z.array(routeIdSchema).min(1).max(WEATHER_RESCHEDULE_MAX_TODO_IDS), {
    decode: (value) => value.split(','),
    encode: (todoIds) => todoIds.join(','),
  }),
  reason: z.enum(WEATHER_RESCHEDULE_REASONS).catch('rain'),
});
