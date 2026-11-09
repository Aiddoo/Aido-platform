import { toEpochMs, toInstant } from '@src/shared/date/instant';

import { createTodoComment } from '../__tests__/todo-comment.fixtures';
import {
  createTodoCommentDraftKey,
  getTodoCommentDraftSourceUpdatedAt,
} from './todo-comment-draft';

describe('createTodoCommentDraftKey', () => {
  const target = createTodoComment({ id: 'comment-9' });

  it('1.14.0 이하와 같은 키로 새 댓글·답글·수정 초안을 나눈다', () => {
    // When
    const ids = [
      createTodoCommentDraftKey({ userId: 'user-1', todoId: 3, mode: { type: 'new' } }).id,
      createTodoCommentDraftKey({ userId: 'user-1', todoId: 3, mode: { type: 'reply', target } })
        .id,
      createTodoCommentDraftKey({ userId: 'user-1', todoId: 3, mode: { type: 'edit', target } }).id,
    ];

    // Then
    expect(ids).toEqual([
      'user-1:todo-comment:3:new',
      'user-1:todo-comment:3:reply',
      'user-1:todo-comment:3:edit:comment-9',
    ]);
  });

  it('답글은 대상을 바꿔도 같은 초안을 이어 쓴다', () => {
    // When
    const first = createTodoCommentDraftKey({
      userId: 'user-1',
      todoId: 3,
      mode: { type: 'reply', target },
    });
    const switched = createTodoCommentDraftKey({
      userId: 'user-1',
      todoId: 3,
      mode: { type: 'reply', target: createTodoComment({ id: 'comment-10' }) },
    });

    // Then
    expect(switched.id).toBe(first.id);
  });

  it('수정 초안은 서버 수정 시각보다 오래되면 버릴 수 있게 원본 시각을 준다', () => {
    // Given
    const editedAt = toInstant('2026-09-01T00:00:00.000Z');
    const edited = createTodoComment({ editedAt });

    // When
    const sourceUpdatedAt = [
      getTodoCommentDraftSourceUpdatedAt({ type: 'edit', target: edited }),
      getTodoCommentDraftSourceUpdatedAt({ type: 'reply', target: edited }),
    ];

    // Then
    expect(sourceUpdatedAt).toEqual([toEpochMs(editedAt), undefined]);
  });
});
