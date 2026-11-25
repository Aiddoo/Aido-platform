import { todoCommentContentSchema } from '@aido/api/contracts/todo-comment/v1';
import { TODO_COMMENT_LIMITS } from '@aido/api/vocabulary';
import { z } from 'zod';

import {
  type TodoCommentComposer,
  todoCommentComposerSchema,
} from '../domains/todo-comment-composer.model';
import type { TodoComment } from '../domains/todo-comment.model';

export const todoCommentFormSchema = z.object({
  // 모델 스키마로 검사만 하고 값은 그대로 둔다. 시각 칸의 brand가 출력 타입에만 붙어, 스키마를 그대로 넣으면 폼이 읽는 값(입력 타입)을
  // Policy에 넘길 수 없고 고른 댓글이 검사할 때마다 사본으로 바뀐다
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

export function toReplyFormValues(target: TodoComment): TodoCommentFormValues {
  return { mode: { type: 'reply', target }, items: EMPTY_ITEMS };
}

export function toEditFormValues(target: TodoComment): TodoCommentFormValues {
  return {
    mode: { type: 'edit', target },
    items: target.content == null ? EMPTY_ITEMS : [{ content: target.content }],
  };
}
