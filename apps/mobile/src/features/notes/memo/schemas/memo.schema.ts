import {
  memoListResponseSchema,
  memoResourceLimitResponseSchema,
  memoSchema as memoContractSchema,
} from '@aido/api';
import { z } from 'zod';

/** 서버 계약에서 앱이 쓰는 칸만 고르고, 시각은 앱에서 Date로 다룬다 */
export const memoSchema = memoContractSchema
  .pick({ id: true, content: true, isPinned: true })
  .extend({ createdAt: z.date(), updatedAt: z.date() });
export type Memo = z.infer<typeof memoSchema>;

export const memoPageSchema = memoListResponseSchema.shape.pagination
  .pick({ nextCursor: true, hasNext: true })
  .extend({ items: z.array(memoSchema) });
export type MemoPage = z.infer<typeof memoPageSchema>;

export const memoResourceLimitSchema = memoResourceLimitResponseSchema.pick({
  currentCount: true,
  maxPerUser: true,
});
export type MemoResourceLimit = z.infer<typeof memoResourceLimitSchema>;
