import { WEATHER_RESCHEDULE_MAX_TODO_IDS, WEATHER_RESCHEDULE_REASONS } from '@aido/api';
import { routeIdSchema } from '@src/shared/schemas/route-params.schema';
import { z } from 'zod';

export const weatherRescheduleParamsSchema = z.object({
  todoIds: z.codec(z.string(), z.array(routeIdSchema).min(1).max(WEATHER_RESCHEDULE_MAX_TODO_IDS), {
    decode: (value) => value.split(','),
    encode: (todoIds) => todoIds.join(','),
  }),
  reason: z.enum(WEATHER_RESCHEDULE_REASONS).catch('rain'),
});

export type WeatherRescheduleParams = z.output<typeof weatherRescheduleParamsSchema>;
