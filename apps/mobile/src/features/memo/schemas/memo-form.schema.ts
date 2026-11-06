import { createMemoSchema } from '@aido/api';
import type { z } from 'zod';

/** 작성과 수정의 입력 규칙. 길이 한도는 서버 계약과 같은 값을 쓴다 */
export const memoFormSchema = createMemoSchema.pick({ content: true });
export type MemoFormValues = z.infer<typeof memoFormSchema>;

export const EMPTY_MEMO_FORM_VALUES: MemoFormValues = { content: '' };
