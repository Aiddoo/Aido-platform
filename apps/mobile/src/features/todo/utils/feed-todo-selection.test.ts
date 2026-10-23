import { resolveFeedTodoSelection } from './feed-todo-selection';

describe('resolveFeedTodoSelection', () => {
  it('compact에서 할 일을 고르면 상세 라우트로 push한다', () => {
    expect(resolveFeedTodoSelection('compact', 7)).toEqual({ type: 'push', todoId: 7 });
  });

  it('compact에서 선택 해제는 아무것도 하지 않는다', () => {
    expect(resolveFeedTodoSelection('compact', undefined)).toEqual({ type: 'none' });
  });

  it('medium 이상에서는 todoId를 바꾸고 이전 댓글 상태를 지운다', () => {
    expect(resolveFeedTodoSelection('medium', 7)).toEqual({
      type: 'setParams',
      params: { todoId: '7', comment: undefined, intent: undefined, returnTo: undefined },
    });
  });

  it('medium 이상에서 선택 해제는 todoId를 지운다', () => {
    expect(resolveFeedTodoSelection('expanded', undefined)).toEqual({
      type: 'setParams',
      params: { todoId: undefined, comment: undefined, intent: undefined, returnTo: undefined },
    });
  });
});
