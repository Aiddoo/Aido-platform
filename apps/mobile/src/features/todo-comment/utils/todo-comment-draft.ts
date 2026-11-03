import { TODO_COMMENT_LIMITS } from '@aido/api';
import { createDraftKey } from '@src/shared/draft/draft.model';
import { z } from 'zod';

import {
  type TodoCommentComposerMode,
  TodoCommentComposer,
} from '../domains/todo-comment-composer.model';

// 길이 제한은 제출 시 작성기 스키마가 검사한다. 초안은 쓰던 글을 그대로 돌려준다.
const todoCommentDraftSchema = z.object({
  items: z
    .array(z.object({ content: z.string() }))
    .min(1)
    .max(TODO_COMMENT_LIMITS.CHAIN_MAX_SIZE),
});

export type TodoCommentDraft = z.infer<typeof todoCommentDraftSchema>;

interface CreateTodoCommentDraftKeyInput {
  userId: string;
  todoId: number;
  mode: TodoCommentComposerMode;
}

/** 답글은 대상을 바꿔도 같은 글을 이어 쓰므로 대상 글을 키에 넣지 않는다 */
export function createTodoCommentDraftKey({
  userId,
  todoId,
  mode,
}: CreateTodoCommentDraftKeyInput) {
  return createDraftKey({
    ownerId: userId,
    scope: 'todo-comment',
    target: TodoCommentComposer.draftTargetOf(todoId, mode),
    schema: todoCommentDraftSchema,
  });
}
