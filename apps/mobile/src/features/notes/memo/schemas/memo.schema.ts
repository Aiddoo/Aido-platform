import {
  memoListResponseSchema,
  memoResourceLimitResponseSchema,
  memoSchema as memoContractSchema,
  parsedMemoDataSchema,
  parsedMemoTodoSchema,
  parseMemoMetaSchema,
  parseMemoResponseSchema,
} from '@aido/api';
import { AI_PARSE_LIMITS } from '@aido/api/vocabulary';
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

/** 지금 서버는 반복 규칙, 겹치는 할 일, 생략한 개수를 항상 싣는다. 계약의 선택 칸을 앱에서는 필수로 읽는다 */
export const parseMemoPlanResponseSchema = parseMemoResponseSchema.extend({
  data: parsedMemoDataSchema.extend({
    todos: z
      .array(parsedMemoTodoSchema.required({ repeat: true, duplicateOfTodoId: true }))
      .min(1)
      .max(AI_PARSE_LIMITS.MEMO_MAX_TODOS),
  }),
  meta: parseMemoMetaSchema.required({ omittedTodoCount: true }),
});
export type ParseMemoPlanResponse = z.infer<typeof parseMemoPlanResponseSchema>;
