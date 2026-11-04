import { memoResourceLimitResponseSchema, memoSchema } from '@aido/api';
import { z } from 'zod';

export const memoItemSchema = memoSchema
  .pick({ id: true, content: true, isPinned: true, sortOrder: true })
  .extend({ createdAt: z.date(), updatedAt: z.date() });

export type MemoItem = z.infer<typeof memoItemSchema>;

export const memoPageSchema = z.object({
  items: z.array(memoItemSchema),
  nextCursor: z.number().nullable(),
  hasNext: z.boolean(),
});
export type MemoPage = z.infer<typeof memoPageSchema>;

export const memoResourceLimitSchema = memoResourceLimitResponseSchema;
export type MemoResourceLimit = z.infer<typeof memoResourceLimitSchema>;

export function isMemoCreatable(limit: MemoResourceLimit): boolean {
  return limit.currentCount < limit.maxPerUser;
}

export const MemoPolicy = {
  isCreatable: isMemoCreatable,
} as const;
