import { createTodoComment } from '../../__tests__/todo-comment.factories';
import { getTodoCommentBackResult, resolveHardwareBackAction } from './todo-comment-back';

describe('getTodoCommentBackResult', () => {
  const target = createTodoComment();

  it('답글·수정 중이면 화면보다 작성기를 먼저 닫는다', () => {
    // When
    const results = [
      getTodoCommentBackResult({ mode: { type: 'reply', target }, isSubmitting: false }),
      getTodoCommentBackResult({ mode: { type: 'edit', target }, isSubmitting: false }),
      getTodoCommentBackResult({ mode: { type: 'new' }, isSubmitting: false }),
    ];

    // Then
    expect(results).toEqual(['closeComposer', 'closeComposer', 'native']);
  });

  it('보내는 중에는 초안을 지키려고 뒤로가기를 막는다', () => {
    // When
    const result = getTodoCommentBackResult({ mode: { type: 'new' }, isSubmitting: true });

    // Then
    expect(result).toBe('blocked');
  });
});

describe('resolveHardwareBackAction', () => {
  it('댓글이 처리하지 않은 뒤로가기는 pane이면 선택을 풀고 화면이면 기본 동작이다', () => {
    // When
    const actions = [
      resolveHardwareBackAction({ isHandledByComment: true, canExit: true }),
      resolveHardwareBackAction({ isHandledByComment: false, canExit: true }),
      resolveHardwareBackAction({ isHandledByComment: false, canExit: false }),
    ];

    // Then
    expect(actions).toEqual(['consume', 'exit', 'native']);
  });
});
