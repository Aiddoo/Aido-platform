import { todoCategoryIdParamSchema } from '@aido/api';
import { routeIntegerStringSchema } from '@src/shared/schemas/route-params.schema';
import { z } from 'zod';

export const todoCategoryParamsSchema = z.object({
  categoryId: routeIntegerStringSchema.pipe(todoCategoryIdParamSchema.shape.id),
});
