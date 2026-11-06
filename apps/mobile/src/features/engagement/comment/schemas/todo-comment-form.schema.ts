import type { createTodoCommentChainSchema, updateTodoCommentSchema } from '@aido/api';
import { todoCommentContentSchema } from '@aido/api';
import { TODO_COMMENT_LIMITS } from '@aido/api/vocabulary';
import { z } from 'zod';

import { type TodoComment, todoCommentSchema } from './todo-comment.schema';

const todoCommentComposerModeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('new') }),
  z.object({ type: z.literal('reply'), target: todoCommentSchema }),
  z.object({ type: z.literal('edit'), target: todoCommentSchema }),
]);
export type TodoCommentComposerMode = z.infer<typeof todoCommentComposerModeSchema>;

export const todoCommentFormSchema = z.object({
  mode: todoCommentComposerModeSchema,
  items: z
    .array(z.object({ content: todoCommentContentSchema }))
    .min(1)
    .max(TODO_COMMENT_LIMITS.CHAIN_MAX_SIZE),
});
export type TodoCommentFormValues = z.infer<typeof todoCommentFormSchema>;

export type TodoCommentChainInput = z.infer<typeof createTodoCommentChainSchema>;
export type TodoCommentUpdateInput = z.infer<typeof updateTodoCommentSchema>;

const EMPTY_ITEMS: TodoCommentFormValues['items'] = [{ content: '' }];

export const NEW_TODO_COMMENT_FORM_VALUES: TodoCommentFormValues = {
  mode: { type: 'new' },
  items: EMPTY_ITEMS,
};

export function toReplyFormValues(target: TodoComment): TodoCommentFormValues {
  return { mode: { type: 'reply', target }, items: EMPTY_ITEMS };
}

export function toEditFormValues(target: TodoComment): TodoCommentFormValues {
  return { mode: { type: 'edit', target }, items: [{ content: target.content ?? '' }] };
}
