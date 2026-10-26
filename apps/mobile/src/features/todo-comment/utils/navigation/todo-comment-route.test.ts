import { TODO_COMMENT_SORT } from '@aido/api';

import {
  areTodoCommentRoutesEqual,
  createTodoCommentScreenHrefs,
  parseTodoCommentRoute,
  resolveTodoCommentRouteNavigation,
  reduceTodoCommentRoute,
  serializeTodoCommentRoute,
  type TodoCommentRoute,
} from './todo-comment-route';

const COMMENT_ID = 'cmt92zn3n000b7voxx9quc2th';
const SECOND_COMMENT_ID = 'cmt92zn3n000c7voxx9quc2ti';
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

describe('parseTodoCommentRoute', () => {
  test('search가 없으면 최신순 댓글 개요로 정규화한다', () => {
    expect(parseTodoCommentRoute({})).toEqual(OVERVIEW_ROUTE);
  });

  test('comment만 있는 기존 알림 URL은 대화 보기로 복구한다', () => {
    expect(parseTodoCommentRoute({ sort: TODO_COMMENT_SORT.POPULAR, comment: COMMENT_ID })).toEqual(
      {
        sort: TODO_COMMENT_SORT.POPULAR,
        view: 'conversation',
        commentId: COMMENT_ID,
        form: null,
      },
    );
  });

  test('thread intent는 returnTo를 무시하고 대화를 연다', () => {
    expect(
      parseTodoCommentRoute({ comment: COMMENT_ID, intent: 'thread', returnTo: 'overview' }),
    ).toEqual(CONVERSATION_ROUTE);
  });

  test.each(['reply', 'edit'] as const)('%s intent는 검증된 복귀 문맥을 보존한다', (intent) => {
    expect(parseTodoCommentRoute({ comment: COMMENT_ID, intent, returnTo: 'overview' })).toEqual({
      ...CONVERSATION_ROUTE,
      form: { type: intent, returnView: 'overview' },
    });
  });

  test.each([undefined, 'invalid', ['overview']] as const)(
    'reply/edit의 returnTo=%p는 기존 호환을 위해 대화로 복구한다',
    (returnTo) => {
      expect(parseTodoCommentRoute({ comment: COMMENT_ID, intent: 'reply', returnTo })).toEqual({
        ...CONVERSATION_ROUTE,
        form: { type: 'reply', returnView: 'conversation' },
      });
    },
  );

  test('create는 comment 없이만 허용한다', () => {
    expect(parseTodoCommentRoute({ intent: 'create' })).toEqual({
      ...OVERVIEW_ROUTE,
      form: { type: 'new' },
    });
    expect(parseTodoCommentRoute({ comment: COMMENT_ID, intent: 'create' })).toEqual(
      OVERVIEW_ROUTE,
    );
  });

  test('잘못된 ID, intent, 배열 search는 안전하게 개요로 복구한다', () => {
    expect(parseTodoCommentRoute({ comment: 'invalid', intent: 'reply' })).toEqual(OVERVIEW_ROUTE);
    expect(parseTodoCommentRoute({ comment: COMMENT_ID, intent: 'unknown' })).toEqual(
      OVERVIEW_ROUTE,
    );
    expect(parseTodoCommentRoute({ sort: [TODO_COMMENT_SORT.POPULAR] })).toEqual(OVERVIEW_ROUTE);
  });
});

describe('reduceTodoCommentRoute', () => {
  test('새 댓글은 취소와 완료 모두 개요로 닫는다', () => {
    const newCommentRoute = reduceTodoCommentRoute(OVERVIEW_ROUTE, { type: 'startNewComment' });

    expect(reduceTodoCommentRoute(newCommentRoute, { type: 'cancelForm' })).toEqual(OVERVIEW_ROUTE);
    expect(reduceTodoCommentRoute(newCommentRoute, { type: 'completeForm' })).toEqual(
      OVERVIEW_ROUTE,
    );
  });

  test('개요에서 연 답글은 취소 시 개요로, 완료 시 선택한 대화로 간다', () => {
    const replyRoute = reduceTodoCommentRoute(OVERVIEW_ROUTE, {
      type: 'startReply',
      commentId: COMMENT_ID,
    });

    expect(replyRoute).toEqual({
      ...CONVERSATION_ROUTE,
      form: { type: 'reply', returnView: 'overview' },
    });
    expect(reduceTodoCommentRoute(replyRoute, { type: 'cancelForm' })).toEqual(OVERVIEW_ROUTE);
    expect(reduceTodoCommentRoute(replyRoute, { type: 'completeForm' })).toEqual(
      CONVERSATION_ROUTE,
    );
  });

  test('답글 작성 중 대상을 바꿔도 최초 복귀 문맥을 보존한다', () => {
    const firstReplyRoute = reduceTodoCommentRoute(OVERVIEW_ROUTE, {
      type: 'startReply',
      commentId: COMMENT_ID,
    });

    expect(
      reduceTodoCommentRoute(firstReplyRoute, {
        type: 'startReply',
        commentId: SECOND_COMMENT_ID,
      }),
    ).toEqual({
      sort: TODO_COMMENT_SORT.LATEST,
      view: 'conversation',
      commentId: SECOND_COMMENT_ID,
      form: { type: 'reply', returnView: 'overview' },
    });
  });

  test('정렬 변경은 현재 화면과 form을 유지하며 같은 값에는 identity를 보존한다', () => {
    expect(reduceTodoCommentRoute(CONVERSATION_ROUTE, { type: 'changeSort', sort: 'LATEST' })).toBe(
      CONVERSATION_ROUTE,
    );
    expect(
      reduceTodoCommentRoute(CONVERSATION_ROUTE, { type: 'changeSort', sort: 'POPULAR' }),
    ).toEqual({ ...CONVERSATION_ROUTE, sort: TODO_COMMENT_SORT.POPULAR });
  });
});

describe('serializeTodoCommentRoute', () => {
  test.each([
    OVERVIEW_ROUTE,
    { ...OVERVIEW_ROUTE, form: { type: 'new' } },
    CONVERSATION_ROUTE,
    {
      ...CONVERSATION_ROUTE,
      form: { type: 'reply', returnView: 'overview' },
    },
    {
      ...CONVERSATION_ROUTE,
      form: { type: 'edit', returnView: 'conversation' },
    },
  ] satisfies TodoCommentRoute[])('유효한 내부 route를 wire 형식으로 왕복한다', (route) => {
    expect(parseTodoCommentRoute(serializeTodoCommentRoute(route))).toEqual(route);
  });
});

describe('areTodoCommentRoutesEqual', () => {
  test('값이 같은 route는 객체 identity와 무관하게 같다', () => {
    expect(areTodoCommentRoutesEqual(CONVERSATION_ROUTE, { ...CONVERSATION_ROUTE })).toBe(true);
  });

  test('comment, form 출처, sort 중 하나라도 다르면 다른 route다', () => {
    expect(
      areTodoCommentRoutesEqual(CONVERSATION_ROUTE, {
        ...CONVERSATION_ROUTE,
        commentId: SECOND_COMMENT_ID,
      }),
    ).toBe(false);
    expect(
      areTodoCommentRoutesEqual(
        { ...CONVERSATION_ROUTE, form: { type: 'reply', returnView: 'overview' } },
        { ...CONVERSATION_ROUTE, form: { type: 'reply', returnView: 'conversation' } },
      ),
    ).toBe(false);
    expect(
      areTodoCommentRoutesEqual(CONVERSATION_ROUTE, {
        ...CONVERSATION_ROUTE,
        sort: TODO_COMMENT_SORT.POPULAR,
      }),
    ).toBe(false);
  });
});

describe('reduceTodoCommentRoute의 게시 완료 focus', () => {
  test('답글을 게시하면 새 답글을 focus한 대화에 남는다', () => {
    expect(
      reduceTodoCommentRoute(
        { ...CONVERSATION_ROUTE, form: { type: 'reply', returnView: 'overview' } },
        { type: 'completeForm', focusCommentId: SECOND_COMMENT_ID },
      ),
    ).toEqual({ ...CONVERSATION_ROUTE, commentId: SECOND_COMMENT_ID });
  });
});

describe('resolveTodoCommentRouteNavigation', () => {
  const TODO_ID = 42;

  test('화면의 개요에서 대화를 열면 대화 화면을 한 단계 push한다', () => {
    expect(
      resolveTodoCommentRouteNavigation({
        todoId: TODO_ID,
        route: OVERVIEW_ROUTE,
        action: { type: 'openConversation', commentId: COMMENT_ID },
        presentation: 'screen',
      }),
    ).toEqual({
      type: 'push',
      href: {
        pathname: '/todo/[todoId]/comments/[commentId]',
        params: {
          todoId: TODO_ID,
          commentId: COMMENT_ID,
          sort: TODO_COMMENT_SORT.LATEST,
          intent: undefined,
          returnTo: undefined,
        },
      },
    });
  });

  test('화면의 개요에서 답글을 시작하면 작성기를 연 대화를 push하고 개요를 복귀 문맥으로 둔다', () => {
    expect(
      resolveTodoCommentRouteNavigation({
        todoId: TODO_ID,
        route: OVERVIEW_ROUTE,
        action: { type: 'startReply', commentId: COMMENT_ID },
        presentation: 'screen',
      }),
    ).toMatchObject({
      type: 'push',
      href: { params: { commentId: COMMENT_ID, intent: 'reply', returnTo: 'overview' } },
    });
  });

  test('화면의 대화에서 개요로 돌아가면 history를 늘리지 않고 pop한다', () => {
    expect(
      resolveTodoCommentRouteNavigation({
        todoId: TODO_ID,
        route: CONVERSATION_ROUTE,
        action: { type: 'showOverview' },
        presentation: 'screen',
      }),
    ).toEqual({ type: 'back' });
    expect(
      resolveTodoCommentRouteNavigation({
        todoId: TODO_ID,
        route: { ...CONVERSATION_ROUTE, form: { type: 'reply', returnView: 'overview' } },
        action: { type: 'cancelForm' },
        presentation: 'screen',
      }),
    ).toEqual({ type: 'back' });
  });

  test('화면의 대화 안 focus 이동은 같은 화면의 path param만 바꾼다', () => {
    expect(
      resolveTodoCommentRouteNavigation({
        todoId: TODO_ID,
        route: CONVERSATION_ROUTE,
        action: { type: 'startReply', commentId: SECOND_COMMENT_ID },
        presentation: 'screen',
      }),
    ).toEqual({
      type: 'setParams',
      params: {
        commentId: SECOND_COMMENT_ID,
        sort: TODO_COMMENT_SORT.LATEST,
        intent: 'reply',
        returnTo: 'thread',
      },
    });
  });

  test('pane은 Stack이 없어 모든 전이를 search로 처리한다', () => {
    expect(
      resolveTodoCommentRouteNavigation({
        todoId: TODO_ID,
        route: OVERVIEW_ROUTE,
        action: { type: 'openConversation', commentId: COMMENT_ID },
        presentation: 'pane',
      }),
    ).toEqual({
      type: 'setParams',
      params: serializeTodoCommentRoute(CONVERSATION_ROUTE),
    });
    expect(
      resolveTodoCommentRouteNavigation({
        todoId: TODO_ID,
        route: CONVERSATION_ROUTE,
        action: { type: 'showOverview' },
        presentation: 'pane',
      }),
    ).toEqual({ type: 'setParams', params: serializeTodoCommentRoute(OVERVIEW_ROUTE) });
  });

  test('바뀌는 것이 없으면 이동하지 않는다', () => {
    expect(
      resolveTodoCommentRouteNavigation({
        todoId: TODO_ID,
        route: CONVERSATION_ROUTE,
        action: { type: 'openConversation', commentId: COMMENT_ID },
        presentation: 'screen',
      }),
    ).toEqual({ type: 'none' });
  });
});

describe('createTodoCommentScreenHrefs', () => {
  test('대화는 개요 위에 쌓아 뒤로가기가 그 할 일의 댓글 개요로 올라간다', () => {
    expect(
      createTodoCommentScreenHrefs({
        todoId: 42,
        route: { ...CONVERSATION_ROUTE, sort: TODO_COMMENT_SORT.POPULAR },
      }),
    ).toEqual({
      overviewHref: {
        pathname: '/todo/[todoId]',
        params: {
          todoId: 42,
          sort: TODO_COMMENT_SORT.POPULAR,
          comment: undefined,
          intent: undefined,
          returnTo: undefined,
        },
      },
      threadHref: {
        pathname: '/todo/[todoId]/comments/[commentId]',
        params: {
          todoId: 42,
          commentId: COMMENT_ID,
          sort: TODO_COMMENT_SORT.POPULAR,
          intent: undefined,
          returnTo: undefined,
        },
      },
    });
  });

  test('개요의 새 댓글 작성기는 개요 화면 하나로 넘긴다', () => {
    expect(
      createTodoCommentScreenHrefs({
        todoId: 42,
        route: { ...OVERVIEW_ROUTE, form: { type: 'new' } },
      }),
    ).toMatchObject({
      overviewHref: { params: { intent: 'create' } },
      threadHref: null,
    });
  });
});
