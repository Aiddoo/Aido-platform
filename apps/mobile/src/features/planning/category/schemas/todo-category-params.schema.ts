import { routeIntegerStringSchema } from '@src/shared/schemas/route-params.schema';
import { z } from 'zod';

import { todoCategoryIdSchema } from './todo-category.schema';

export const todoCategoryParamsSchema = z.object({
  categoryId: routeIntegerStringSchema.pipe(todoCategoryIdSchema),
});
