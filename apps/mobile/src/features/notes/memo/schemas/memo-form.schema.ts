import { createMemoSchema } from '@aido/api';
import { trimmed } from '@src/shared/schemas/trimmed.schema';
import type { z } from 'zod';

export const memoFormSchema = createMemoSchema.pick({ content: true }).extend({
  content: trimmed(createMemoSchema.shape.content),
});
export type MemoFormValues = z.infer<typeof memoFormSchema>;

export const EMPTY_MEMO_FORM_VALUES: MemoFormValues = { content: '' };
