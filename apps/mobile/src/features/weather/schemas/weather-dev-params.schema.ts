import { WEATHER_CONDITIONS } from '@aido/api/vocabulary';
import { z } from 'zod';

export const weatherDevParamsSchema = z.object({
  devScene: z.enum(WEATHER_CONDITIONS),
  devNight: z.enum(['0', '1']).default('0'),
});
