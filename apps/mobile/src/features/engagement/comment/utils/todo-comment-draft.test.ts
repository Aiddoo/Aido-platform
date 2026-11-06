import { createTodoComment } from '../__tests__/todo-comment.fixtures';
import { createTodoCommentDraftKey } from './todo-comment-draft';

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
});
