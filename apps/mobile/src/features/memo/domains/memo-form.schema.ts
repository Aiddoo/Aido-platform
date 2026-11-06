import { MEMO_LIMITS } from '@aido/api/vocabulary';
import { z } from 'zod';

export const memoFormSchema = z.object({
  content: z.string().min(1).max(MEMO_LIMITS.MAX_CONTENT_LENGTH),
});
export type MemoFormValues = z.infer<typeof memoFormSchema>;

export const EMPTY_MEMO_FORM_VALUES: MemoFormValues = { content: '' };
