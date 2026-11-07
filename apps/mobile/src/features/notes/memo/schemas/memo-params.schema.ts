import { routeIdSchema } from '@src/shared/utils/route-params';
import { z } from 'zod';

export const memoParamsSchema = z.object({ memoId: routeIdSchema });

export const selectedMemoParamsSchema = z.object({
  memoId: routeIdSchema.optional().catch(undefined),
});
