import { WEATHER_CONDITIONS } from '@aido/api/vocabulary';
import { z } from 'zod';

/**
 * `?devScene=HAIL&devNight=1` — 개발 빌드 QA가 바꿔 볼 날씨와 밤 여부. `devNight`가 없으면 낮이다.
 * 낯선 값은 `devScene`이 undefined, `devNight`가 null이고 읽는 쪽이 덮어쓰기를 끈다
 */
export const weatherDevParamsSchema = z.object({
  devScene: z.enum(WEATHER_CONDITIONS).optional().catch(undefined),
  devNight: z.enum(['0', '1']).default('0').nullable().catch(null),
});
