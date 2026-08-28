import { TODO_COMMENT_SORT } from '@aido/validators';

import {
  areTodoCommentRoutesEqual,
  parseTodoCommentRoute,
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
