import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

/**
 * 앱이 다루는 메모. 서버 응답 모양과 따로 두고 mapper(`apis/memo.mapper.ts`)가 응답을 이 모양으로 바꾼다.
 * 서버 필드가 바뀌어도 mapper만 고치면 화면과 규칙은 그대로다.
 */
export const memoSchema = z.object({
  id: z.int().positive(),
  content: z.string(),
  isPinned: z.boolean(),
  createdAt: instantSchema,
  updatedAt: instantSchema,
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

/** 지금 개수가 한도보다 적어야 새 메모를 만들 수 있다 */
export function canCreateMemo(limit: MemoResourceLimit) {
  return limit.currentCount < limit.maxPerUser;
}

/** 저장은 앞뒤 공백을 빼고 하므로 공백만 고친 글자는 바뀐 것이 아니다 */
export function hasContentChanged(memo: Pick<Memo, 'content'>, content: string) {
  return content.trim() !== memo.content;
}

export const MemoPolicy = {
  canCreateMemo,
  hasContentChanged,
} as const;
