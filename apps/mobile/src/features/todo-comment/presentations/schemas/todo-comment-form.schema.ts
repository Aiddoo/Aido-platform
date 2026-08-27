import { TODO_COMMENT_LIMITS, todoCommentContentSchema } from '@aido/validators';
import { z } from 'zod';

export const todoCommentFormSchema = z.object({
  items: z
    .array(z.object({ content: todoCommentContentSchema }))
    .min(1)
    .max(TODO_COMMENT_LIMITS.CHAIN_MAX_SIZE),
});

export type TodoCommentFormInput = z.infer<typeof todoCommentFormSchema>;
