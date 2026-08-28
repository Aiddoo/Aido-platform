import { TODO_COMMENT_SORT } from '@aido/validators';

import { getTodoCommentBackResult } from './todo-comment-back';
import type { TodoCommentRoute } from './todo-comment-route';

const COMMENT_ID = 'cmt92zn3n000b7voxx9quc2th';
const OVERVIEW_ROUTE: TodoCommentRoute = {
  sort: TODO_COMMENT_SORT.LATEST,
  view: 'overview',
  form: null,
};
const CONVERSATION_ROUTE: TodoCommentRoute = {
  sort: TODO_COMMENT_SORT.LATEST,
  view: 'conversation',
  commentId: COMMENT_ID,
  form: null,
};

describe('getTodoCommentBackResult', () => {
  test('댓글 개요에서만 native stack을 pop한다', () => {
    expect(getTodoCommentBackResult({ route: OVERVIEW_ROUTE, isSubmitting: false })).toEqual({
      status: 'native',
    });
  });

  test('새 댓글 form은 현재 route에서 개요로 닫는다', () => {
    expect(
      getTodoCommentBackResult({
        route: { ...OVERVIEW_ROUTE, form: { type: 'new' } },
        isSubmitting: false,
      }),
    ).toEqual({
      status: 'navigate',
      destination: 'overview',
      labelKey: 'screen.closeForm',
    });
  });

  test('대화는 댓글 개요로 돌아간다', () => {
    expect(getTodoCommentBackResult({ route: CONVERSATION_ROUTE, isSubmitting: false })).toEqual({
      status: 'navigate',
      destination: 'overview',
      labelKey: 'screen.backToOverview',
    });
  });

  test.each(['reply', 'edit'] as const)('%s form은 저장된 진입 문맥으로 돌아간다', (type) => {
    expect(
      getTodoCommentBackResult({
        route: {
          ...CONVERSATION_ROUTE,
          form: { type, returnView: 'overview' },
        },
        isSubmitting: false,
      }),
    ).toEqual({
      status: 'navigate',
      destination: 'overview',
      labelKey: 'screen.backToOverview',
    });

    expect(
      getTodoCommentBackResult({
        route: {
          ...CONVERSATION_ROUTE,
          form: { type, returnView: 'conversation' },
        },
        isSubmitting: false,
      }),
    ).toEqual({
      status: 'navigate',
      destination: 'conversation',
      labelKey: 'screen.backToThread',
    });
  });

  test.each([
    OVERVIEW_ROUTE,
    { ...OVERVIEW_ROUTE, form: { type: 'new' } },
    CONVERSATION_ROUTE,
    { ...CONVERSATION_ROUTE, form: { type: 'reply', returnView: 'overview' } },
    { ...CONVERSATION_ROUTE, form: { type: 'edit', returnView: 'conversation' } },
  ] satisfies TodoCommentRoute[])('전송 중에는 route를 변경하지 않는다', (route) => {
    expect(getTodoCommentBackResult({ route, isSubmitting: true })).toEqual({
      status: 'blocked',
      reason: 'comment-submitting',
    });
  });
});
