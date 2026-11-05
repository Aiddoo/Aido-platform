import {
  getNextTodoCommentPageParam,
  getPreviousTodoCommentPageParam,
  toRepliesQuery,
  toThreadsQuery,
} from './todo-comment-page-params';

const COMMENT_ID = 'cmt92zn3n000b7voxx9quc2th';

describe('todo-comment-page-params', () => {
  it('첫 페이지만 anchor로 위치를 찾고 이어지는 페이지는 cursor만 보낸다', () => {
    // When
    const first = toThreadsQuery(null, { sort: 'LATEST', anchorCommentId: COMMENT_ID });
    const next = toThreadsQuery('cursor-1', { sort: 'LATEST', anchorCommentId: COMMENT_ID });

    // Then
    expect(first).toEqual({ sort: 'LATEST', size: 30, anchorCommentId: COMMENT_ID });
    expect(next).toEqual({ sort: 'LATEST', size: 30, cursor: 'cursor-1' });
  });

  it('답글은 10개씩 받고 알림으로 연 답글이 든 페이지부터 받는다', () => {
    // When
    const around = toRepliesQuery(null, { aroundReplyId: COMMENT_ID });
    const plain = toRepliesQuery(null, { aroundReplyId: null });

    // Then
    expect(around).toEqual({ size: 10, aroundReplyId: COMMENT_ID });
    expect(plain).toEqual({ size: 10 });
  });

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
