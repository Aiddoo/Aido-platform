import { WEATHER_CONDITIONS } from '@aido/api/vocabulary';
import { z } from 'zod';

/** 개발 빌드 QA가 바꿔 볼 날씨와 밤 여부. 낯선 값은 `devScene`이 undefined, `devNight`가 null이고 덮어쓰기를 끈다 */
export const weatherDevParamsSchema = z.object({
  devScene: z.enum(WEATHER_CONDITIONS).optional().catch(undefined),
  devNight: z.enum(['0', '1']).default('0').nullable().catch(null),
});
