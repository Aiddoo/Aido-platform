import { createMemoSchema } from '@aido/api';
import type { z } from 'zod';

/** 작성과 수정의 입력 규칙. 길이 한도는 서버 계약과 같은 값을 쓴다. 저장 때 앞뒤 공백을 빼므로 공백만이면 서버가 거절하기 전에 유효하지 않게 한다 */
export const memoFormSchema = createMemoSchema.pick({ content: true }).extend({
  content: createMemoSchema.shape.content.refine((content) => content.trim().length > 0),
});
export type MemoFormValues = z.infer<typeof memoFormSchema>;

export const EMPTY_MEMO_FORM_VALUES: MemoFormValues = { content: '' };
