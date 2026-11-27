import { todoCommentContentSchema } from '@aido/api/contracts/todo-comment/v1';
import { TODO_COMMENT_LIMITS } from '@aido/api/vocabulary';
import { z } from 'zod';

import {
  type TodoCommentComposer,
  todoCommentComposerSchema,
} from '../domains/todo-comment-composer.model';

export const todoCommentFormSchema = z.object({
  // 검사만 하고 값은 그대로 둔다. brand가 출력 타입에만 붙어 스키마를 그대로 넣으면 폼 값을 Policy에 넘길 수 없다
  mode: z.custom<TodoCommentComposer>(
    (value) => todoCommentComposerSchema.safeParse(value).success,
  ),
  items: z
    .array(z.object({ content: todoCommentContentSchema }))
    .min(1)
    .max(TODO_COMMENT_LIMITS.CHAIN_MAX_SIZE),
});
export type TodoCommentFormValues = z.infer<typeof todoCommentFormSchema>;

const EMPTY_ITEMS: TodoCommentFormValues['items'] = [{ content: '' }];

export const EMPTY_TODO_COMMENT_FORM_VALUES: TodoCommentFormValues = {
  mode: { type: 'new' },
  items: EMPTY_ITEMS,
};
