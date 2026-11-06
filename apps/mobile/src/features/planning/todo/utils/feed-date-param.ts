import { dateSchema } from '@aido/api';
import { z } from 'zod';

/** 피드 URL의 date. YYYY-MM-DD 또는 today만 받고 나머지는 오늘로 본다. */
export const feedDateParamSchema = z
  .union([dateSchema, z.literal('today')])
  .optional()
  .catch(undefined);
