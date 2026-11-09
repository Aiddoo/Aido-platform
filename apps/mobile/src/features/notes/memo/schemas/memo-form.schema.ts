import { createMemoSchema } from '@aido/api';
import type { z } from 'zod';

/** 길이 한도는 서버 계약과 같다. 저장 때 앞뒤 공백을 빼므로 공백만이면 서버가 거절하기 전에 막는다 */
export const memoFormSchema = createMemoSchema.pick({ content: true }).extend({
  content: createMemoSchema.shape.content.refine((content) => content.trim().length > 0),
});
export type MemoFormValues = z.infer<typeof memoFormSchema>;

export const EMPTY_MEMO_FORM_VALUES: MemoFormValues = { content: '' };
