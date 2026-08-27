import { TODO_COMMENT_LIMITS, TODO_COMMENT_SORT } from '@aido/validators';

import {
  getNextTodoCommentPageParam,
  getPreviousTodoCommentPageParam,
  INITIAL_TODO_COMMENT_PAGE_PARAM,
  toTodoCommentConversationQuery,
  toTodoCommentOverviewQuery,
} from './todo-comment-cursor-page';

describe('todo comment cursor page', () => {
  test('overview 첫 요청에는 cursor를 보내지 않는다', () => {
    expect(
      toTodoCommentOverviewQuery(INITIAL_TODO_COMMENT_PAGE_PARAM, TODO_COMMENT_SORT.LATEST),
    ).toEqual({
      sort: TODO_COMMENT_SORT.LATEST,
      size: TODO_COMMENT_LIMITS.DEFAULT_PAGE_SIZE,
    });
  });

  test('conversation 첫 요청에만 focus comment를 보낸다', () => {
    expect(
      toTodoCommentConversationQuery(
        INITIAL_TODO_COMMENT_PAGE_PARAM,
        TODO_COMMENT_SORT.POPULAR,
        'comment-id',
      ),
    ).toEqual({
      sort: TODO_COMMENT_SORT.POPULAR,
      size: TODO_COMMENT_LIMITS.DEFAULT_PAGE_SIZE,
      focusCommentId: 'comment-id',
    });
  });

  test('앞뒤 페이지는 opaque cursor와 방향만 전달한다', () => {
    expect(
      toTodoCommentConversationQuery(
        { direction: 'before', cursor: 'previous' },
        TODO_COMMENT_SORT.LATEST,
        'ignored-focus',
      ),
    ).toEqual({
      sort: TODO_COMMENT_SORT.LATEST,
      size: TODO_COMMENT_LIMITS.DEFAULT_PAGE_SIZE,
      before: 'previous',
    });
    expect(
      toTodoCommentOverviewQuery({ direction: 'after', cursor: 'next' }, TODO_COMMENT_SORT.LATEST),
    ).toEqual({
      sort: TODO_COMMENT_SORT.LATEST,
      size: TODO_COMMENT_LIMITS.DEFAULT_PAGE_SIZE,
      after: 'next',
    });
  });

  test('서버가 허용한 방향만 다음 page param으로 만든다', () => {
    const pagination = {
      previousCursor: 'previous',
      nextCursor: null,
      hasPrevious: true,
      hasNext: false,
      size: TODO_COMMENT_LIMITS.DEFAULT_PAGE_SIZE,
    };

    expect(getPreviousTodoCommentPageParam(pagination)).toEqual({
      direction: 'before',
      cursor: 'previous',
    });
    expect(getNextTodoCommentPageParam(pagination)).toBeUndefined();
  });
});
