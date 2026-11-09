import { toEpochMs } from '@src/shared/date/instant';
import { createDraftKey } from '@src/shared/draft/draft.model';
import { match } from 'ts-pattern';

import { todoCommentDraftSchema } from '../schemas/todo-comment-draft.schema';
import type { TodoCommentComposerMode } from '../schemas/todo-comment-form.schema';

interface CreateTodoCommentDraftKeyInput {
  userId: string;
  todoId: number;
  mode: TodoCommentComposerMode;
}

/** 초안은 새 댓글·답글은 할 일마다, 수정은 수정하는 글마다 나눈다 */
function getDraftTarget(todoId: number, mode: TodoCommentComposerMode) {
  return match(mode)
    .with({ type: 'edit' }, ({ target }) => [todoId, 'edit', target.id] as const)
    .with({ type: 'reply' }, () => [todoId, 'reply'] as const)
    .with({ type: 'new' }, () => [todoId, 'new'] as const)
    .exhaustive();
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
    target: getDraftTarget(todoId, mode),
    schema: todoCommentDraftSchema,
  });
}

export function getTodoCommentDraftSourceUpdatedAt(mode: TodoCommentComposerMode) {
  return match(mode)
    .with({ type: 'edit' }, ({ target }) => toEpochMs(target.editedAt ?? target.createdAt))
    .otherwise(() => undefined);
}
