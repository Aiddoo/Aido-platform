import { TODO_COMMENT_SORT } from '@aido/validators';

import type { TodoCommentRoute } from './todo-comment-route';
import {
  finishTodoCommentTransition,
  getTodoCommentNavigationAvailability,
  startTodoCommentNavigation,
  startTodoCommentSortChange,
  type PendingTodoCommentTransition,
  type TodoCommentScreenState,
} from './todo-comment-screen-transition';

const COMMENT_ID = 'cmt92zn3n000b7voxx9quc2th';
const SECOND_COMMENT_ID = 'cmt92zn3n000c7voxx9quc2ti';
const OVERVIEW_ROUTE: TodoCommentRoute = {
  sort: TODO_COMMENT_SORT.LATEST,
  view: 'overview',
  form: null,
};
const CURRENT_SCREEN: TodoCommentScreenState = { todoId: 42, route: OVERVIEW_ROUTE };

function expectStartedTransition(
  result: ReturnType<typeof startTodoCommentNavigation>,
): PendingTodoCommentTransition {
  expect(result.status).toBe('started');

  if (result.status !== 'started') {
    throw new Error('화면 전환이 시작되어야 합니다.');
  }

  return result.transition;
}

describe('getTodoCommentNavigationAvailability', () => {
  test('새 댓글과 수정 form에서는 다른 댓글 이동을 막는다', () => {
    expect(
      getTodoCommentNavigationAvailability({
        route: { ...OVERVIEW_ROUTE, form: { type: 'new' } },
        destination: 'conversation',
        isSubmitting: false,
      }),
    ).toEqual({ status: 'blocked', reason: 'comment-form-active' });

    expect(
      getTodoCommentNavigationAvailability({
        route: {
          sort: TODO_COMMENT_SORT.LATEST,
          view: 'conversation',
          commentId: COMMENT_ID,
          form: { type: 'edit', returnView: 'conversation' },
        },
        destination: 'reply',
        isSubmitting: false,
      }),
    ).toEqual({ status: 'blocked', reason: 'comment-form-active' });
  });

  test('답글 form은 답글 대상 변경만 허용한다', () => {
    const replyRoute: TodoCommentRoute = {
      sort: TODO_COMMENT_SORT.LATEST,
      view: 'conversation',
      commentId: COMMENT_ID,
      form: { type: 'reply', returnView: 'overview' },
    };

    expect(
      getTodoCommentNavigationAvailability({
        route: replyRoute,
        destination: 'reply',
        isSubmitting: false,
      }),
    ).toEqual({ status: 'available' });
    expect(
      getTodoCommentNavigationAvailability({
        route: replyRoute,
        destination: 'conversation',
        isSubmitting: false,
      }),
    ).toEqual({ status: 'blocked', reason: 'comment-form-active' });
  });

  test('전송 중에는 답글 대상 변경도 막는다', () => {
    expect(
      getTodoCommentNavigationAvailability({
        route: OVERVIEW_ROUTE,
        destination: 'reply',
        isSubmitting: true,
      }),
    ).toEqual({ status: 'blocked', reason: 'comment-submitting' });
  });
});

describe('todo comment screen transition', () => {
  test('같은 이동을 연속 시작하면 중복 요청으로 무시한다', () => {
    const firstTransition = expectStartedTransition(
      startTodoCommentNavigation({
        currentScreen: CURRENT_SCREEN,
        pendingTransition: null,
        commentId: COMMENT_ID,
        destination: 'conversation',
        isSubmitting: false,
      }),
    );

    expect(
      startTodoCommentNavigation({
        currentScreen: CURRENT_SCREEN,
        pendingTransition: firstTransition,
        commentId: COMMENT_ID,
        destination: 'conversation',
        isSubmitting: false,
      }),
    ).toEqual({ status: 'ignored', reason: 'duplicate-transition' });
  });

  test('새 댓글 이동이 시작되면 늦게 끝난 이전 요청은 stale이다', () => {
    const firstTransition = expectStartedTransition(
      startTodoCommentNavigation({
        currentScreen: CURRENT_SCREEN,
        pendingTransition: null,
        commentId: COMMENT_ID,
        destination: 'conversation',
        isSubmitting: false,
      }),
    );
    const secondTransition = expectStartedTransition(
      startTodoCommentNavigation({
        currentScreen: CURRENT_SCREEN,
        pendingTransition: firstTransition,
        commentId: SECOND_COMMENT_ID,
        destination: 'reply',
        isSubmitting: false,
      }),
    );

    expect(
      finishTodoCommentTransition({
        currentScreen: CURRENT_SCREEN,
        pendingTransition: secondTransition,
        transition: firstTransition,
      }),
    ).toEqual({ status: 'stale' });
    expect(
      finishTodoCommentTransition({
        currentScreen: CURRENT_SCREEN,
        pendingTransition: secondTransition,
        transition: secondTransition,
      }),
    ).toEqual({ status: 'committed' });
  });

  test('요청 도중 route가 바뀌면 동일한 token도 stale이다', () => {
    const transition = expectStartedTransition(
      startTodoCommentNavigation({
        currentScreen: CURRENT_SCREEN,
        pendingTransition: null,
        commentId: COMMENT_ID,
        destination: 'conversation',
        isSubmitting: false,
      }),
    );

    expect(
      finishTodoCommentTransition({
        currentScreen: {
          ...CURRENT_SCREEN,
          route: { ...OVERVIEW_ROUTE, sort: TODO_COMMENT_SORT.POPULAR },
        },
        pendingTransition: transition,
        transition,
      }),
    ).toEqual({ status: 'stale' });
  });

  test('값을 복사한 객체가 아니라 시작할 때 받은 객체 자체만 token으로 인정한다', () => {
    const transition = expectStartedTransition(
      startTodoCommentNavigation({
        currentScreen: CURRENT_SCREEN,
        pendingTransition: null,
        commentId: COMMENT_ID,
        destination: 'conversation',
        isSubmitting: false,
      }),
    );

    expect(
      finishTodoCommentTransition({
        currentScreen: CURRENT_SCREEN,
        pendingTransition: transition,
        transition: { ...transition },
      }),
    ).toEqual({ status: 'stale' });
  });

  test('정렬 전환은 작성 중, 같은 정렬, 다른 전환 진행 중을 구분한다', () => {
    expect(
      startTodoCommentSortChange({
        currentScreen: CURRENT_SCREEN,
        pendingTransition: null,
        nextSort: TODO_COMMENT_SORT.POPULAR,
        isSubmitting: true,
      }),
    ).toEqual({ status: 'blocked', reason: 'comment-submitting' });
    expect(
      startTodoCommentSortChange({
        currentScreen: CURRENT_SCREEN,
        pendingTransition: null,
        nextSort: TODO_COMMENT_SORT.LATEST,
        isSubmitting: false,
      }),
    ).toEqual({ status: 'ignored', reason: 'same-sort' });

    const pendingTransition = expectStartedTransition(
      startTodoCommentNavigation({
        currentScreen: CURRENT_SCREEN,
        pendingTransition: null,
        commentId: COMMENT_ID,
        destination: 'conversation',
        isSubmitting: false,
      }),
    );
    expect(
      startTodoCommentSortChange({
        currentScreen: CURRENT_SCREEN,
        pendingTransition,
        nextSort: TODO_COMMENT_SORT.POPULAR,
        isSubmitting: false,
      }),
    ).toEqual({ status: 'ignored', reason: 'transition-in-progress' });
  });
});
