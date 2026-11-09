import {
  getNextTodoCommentPageParam,
  getPreviousTodoCommentPageParam,
} from './todo-comment-page-params';

describe('todo-comment-page-params', () => {
  it('서버가 준 cursor를 방향 그대로 다음·이전 페이지 값으로 쓴다', () => {
    // Given
    const pagination = {
      previousCursor: 'prev',
      nextCursor: 'next',
      hasPrevious: true,
      hasNext: false,
      size: 30,
    };

    // When
    const params = [
      getNextTodoCommentPageParam(pagination),
      getPreviousTodoCommentPageParam(pagination),
    ];

    // Then
    expect(params).toEqual([undefined, 'prev']);
  });
});
