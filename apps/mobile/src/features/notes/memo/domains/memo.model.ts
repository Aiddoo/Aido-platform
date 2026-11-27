import { instantSchema } from '@src/shared/date/instant';
import { cursorPageSchema } from '@src/shared/domains/cursor-page.model';
import { z } from 'zod';

export const memoSchema = z.object({
  id: z.int().positive(),
  content: z.string(),
  isPinned: z.boolean(),
  createdAt: instantSchema,
  updatedAt: instantSchema,
});
export type Memo = z.infer<typeof memoSchema>;

const memoPageSchema = cursorPageSchema(memoSchema, z.int());
export type MemoPage = z.infer<typeof memoPageSchema>;

export const MemoPolicy = {
  // 저장은 앞뒤 공백을 빼고 하므로 공백만 고친 글자는 바뀐 것이 아니다
  hasContentChanged(memo: Memo, content: string): boolean {
    return content.trim() !== memo.content;
  },
};
