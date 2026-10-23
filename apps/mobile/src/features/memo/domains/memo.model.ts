import { z } from 'zod';

export const memoItemSchema = z.object({
  id: z.number(),
  content: z.string(),
  isPinned: z.boolean(),
  sortOrder: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type MemoItem = z.infer<typeof memoItemSchema>;

export const memoPageSchema = z.object({
  items: z.array(memoItemSchema),
  nextCursor: z.number().nullable(),
  hasNext: z.boolean(),
});
export type MemoPage = z.infer<typeof memoPageSchema>;

export const memoResourceLimitSchema = z.object({
  currentCount: z.number(),
  maxPerUser: z.number(),
});
export type MemoResourceLimit = z.infer<typeof memoResourceLimitSchema>;

export function isMemoCreatable(limit: MemoResourceLimit): boolean {
  return limit.currentCount < limit.maxPerUser;
}

export const MemoPolicy = {
  isCreatable: isMemoCreatable,
} as const;
