import { TODO_COMMENT_LIMITS } from '@aido/api';
import { createDraftKey } from '@src/shared/draft/draft.model';
import { z } from 'zod';

import type { TodoCommentFormSession } from './view-models/todo-comment-form.view-model';

// 길이 제한은 제출 시 폼 스키마가 검사한다. 초안은 쓰던 글을 그대로 돌려준다.
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
  session: TodoCommentFormSession;
}

/** 새 댓글은 할 일마다, 답글은 대상 댓글마다, 수정은 수정하는 댓글마다 초안을 나눈다. */
export function createTodoCommentDraftKey({
  userId,
  todoId,
  session,
}: CreateTodoCommentDraftKeyInput) {
  return createDraftKey({
    ownerId: userId,
    scope: 'todo-comment',
    target: session.type === 'new' ? [todoId, 'new'] : [todoId, session.type, session.target.id],
    schema: todoCommentDraftSchema,
  });
}

export function getTodoCommentDraftSourceUpdatedAt(session: TodoCommentFormSession) {
  if (session.type !== 'edit') {
    return undefined;
  }

  return (session.target.editedAt ?? session.target.createdAt).getTime();
}
