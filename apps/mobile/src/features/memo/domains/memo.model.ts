import { z } from 'zod';

export const memoSchema = z.object({
  id: z.int().positive(),
  content: z.string(),
  isPinned: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Memo = z.infer<typeof memoSchema>;

export const memoPageSchema = z.object({
  items: z.array(memoSchema),
  nextCursor: z.int().nullable(),
  hasNext: z.boolean(),
});
export type MemoPage = z.infer<typeof memoPageSchema>;

export const memoResourceLimitSchema = z.object({
  currentCount: z.int().nonnegative(),
  maxPerUser: z.int().positive(),
});
export type MemoResourceLimit = z.infer<typeof memoResourceLimitSchema>;

export function canCreateMemo(limit: MemoResourceLimit) {
  return limit.currentCount < limit.maxPerUser;
}

export function getMemoPreview(memo: Pick<Memo, 'content'>) {
  const [title = '', ...rest] = memo.content.trim().split('\n');

  return { title: title.trim(), body: rest.join('\n').trim() };
}

export const MemoPolicy = {
  canCreateMemo,
  getMemoPreview,
} as const;
