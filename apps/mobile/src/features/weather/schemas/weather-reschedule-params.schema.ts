import { WEATHER_RESCHEDULE_MAX_TODO_IDS, WEATHER_RESCHEDULE_REASONS } from '@aido/api';
import { routeIdSchema } from '@src/shared/schemas/route-params.schema';
import { z } from 'zod';

/** `?todoIds=12,15&reason=heat`. reason이 없거나 낯선 값이면 기존 링크처럼 비를 피한다 */
export const weatherRescheduleParamsSchema = z.object({
  todoIds: z.codec(z.string(), z.array(routeIdSchema).min(1).max(WEATHER_RESCHEDULE_MAX_TODO_IDS), {
    decode: (value) => value.split(','),
    encode: (todoIds) => todoIds.join(','),
  }),
  reason: z.enum(WEATHER_RESCHEDULE_REASONS).catch('rain'),
});

export type WeatherRescheduleParams = z.output<typeof weatherRescheduleParamsSchema>;
