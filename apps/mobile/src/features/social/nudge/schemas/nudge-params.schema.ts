import { userIdParamSchema } from '@aido/api/contracts/follow/v1';
import { nudgeIdParamSchema } from '@aido/api/contracts/nudge/v1';
import { routeIntegerStringSchema } from '@src/shared/schemas/route-params.schema';
import { z } from 'zod';

export const nudgeParamsSchema = z.object({
  nudgeId: routeIntegerStringSchema.pipe(nudgeIdParamSchema.shape.id),
});

export const remindNudgeParamsSchema = userIdParamSchema.extend({
  name: z.string().trim().min(1),
});
