import { createTodoComment } from '../__tests__/todo-comment.fixtures';
import { getTodoCommentBackAction } from './todo-comment-back.view-model';

describe('getTodoCommentBackAction', () => {
  it.each(['reply', 'edit'] as const)('%s 중이면 화면보다 작성기를 먼저 닫는다', (type) => {
    // Given
    const mode = { type, target: createTodoComment() };

    // When
    const action = getTodoCommentBackAction(mode, { isSubmitting: false });

    // Then
    expect(action).toBe('closeComposer');
  });

  it('새 댓글을 쓰는 중이면 화면을 닫는 기본 동작에 맡긴다', () => {
    // When
    const action = getTodoCommentBackAction({ type: 'new' }, { isSubmitting: false });

    // Then
    expect(action).toBe('native');
  });

  it('보내는 중에는 초안을 지키려고 뒤로가기를 막는다', () => {
    // When
    const action = getTodoCommentBackAction({ type: 'new' }, { isSubmitting: true });

    // Then
    expect(action).toBe('blocked');
  });
});
