import { nudgeIdParamSchema, userIdParamSchema } from '@aido/api';
import { routeIntegerStringSchema } from '@src/shared/utils/route-params';
import { z } from 'zod';

export const nudgeScreenParamsSchema = z.object({
  nudgeId: routeIntegerStringSchema.pipe(nudgeIdParamSchema.shape.id),
});

export const remindNudgeRouteParamsSchema = userIdParamSchema.extend({
  name: z.string().trim().min(1),
});
