import { z } from 'zod';

const WEATHER_ENTRIES = ['feed_badge', 'notification'] as const;
export type WeatherEntry = (typeof WEATHER_ENTRIES)[number];

export const weatherEntryParamsSchema = z.object({
  entry: z.enum(WEATHER_ENTRIES).optional().catch(undefined),
});
