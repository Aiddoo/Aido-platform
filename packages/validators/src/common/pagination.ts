import { z } from 'zod';

export const numberCursorPaginationInfoSchema = z.object({
  nextCursor: z.number().int().nullable(),
  hasNext: z.boolean(),
  size: z.number(),
});
