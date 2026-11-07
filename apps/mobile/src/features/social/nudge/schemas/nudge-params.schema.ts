import { nudgeIdParamSchema, userIdParamSchema } from '@aido/api';
import { routeIntegerStringSchema } from '@src/shared/utils/route-params';
import { z } from 'zod';

export const nudgeParamsSchema = z.object({
  nudgeId: routeIntegerStringSchema.pipe(nudgeIdParamSchema.shape.id),
});

export const remindNudgeParamsSchema = userIdParamSchema.extend({
  name: z.string().trim().min(1),
});
