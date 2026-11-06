import {
  memoListResponseSchema,
  memoResourceLimitResponseSchema,
  memoSchema as memoContractSchema,
} from '@aido/api';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

/** 서버 계약에서 앱이 쓰는 칸만 고르고, 시각은 Date로 바꾸지 않고 Instant 그대로 둔다 */
export const memoSchema = memoContractSchema
  .pick({ id: true, content: true, isPinned: true })
  .extend({ createdAt: instantSchema, updatedAt: instantSchema });
export type Memo = z.infer<typeof memoSchema>;

const memoPageSchema = memoListResponseSchema.shape.pagination
  .pick({ nextCursor: true, hasNext: true })
  .extend({ items: z.array(memoSchema) });
export type MemoPage = z.infer<typeof memoPageSchema>;

const memoResourceLimitSchema = memoResourceLimitResponseSchema.pick({
  currentCount: true,
  maxPerUser: true,
});
export type MemoResourceLimit = z.infer<typeof memoResourceLimitSchema>;
