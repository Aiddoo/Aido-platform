import { suggestionIdParamSchema } from '@aido/api';
import { routeIntegerStringSchema } from '@src/shared/schemas/route-params.schema';
import { z } from 'zod';

export const suggestionParamsSchema = z.object({
  suggestionId: routeIntegerStringSchema.pipe(suggestionIdParamSchema.shape.id),
});
