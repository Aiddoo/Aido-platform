import { z } from 'zod';

/** 날씨 화면으로 들어온 곳. 화면이 `weather_opened`로 한 번 남긴다 */
const WEATHER_ENTRIES = ['feed_badge', 'notification'] as const;
export type WeatherEntry = (typeof WEATHER_ENTRIES)[number];

/** `?entry=feed_badge` — 진입점. 없거나 낯선 값(딥 링크·되돌아오기)은 없는 것으로 본다 */
export const weatherEntryParamsSchema = z.object({
  entry: z.enum(WEATHER_ENTRIES).optional().catch(undefined),
});
