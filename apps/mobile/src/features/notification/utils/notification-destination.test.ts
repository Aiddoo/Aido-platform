import type { NotificationNavigation } from '../schemas/push-notification-payload.schema';
import {
  isViewingNotificationDestination,
  type NotificationDestination,
  toNotificationDestination,
} from './notification-destination';

const COMMENT_ID = 'cmt92zn3n000b7voxx9quc2th';
const VIEWER = 'cmviewer00000000000000001';
const FRIEND = 'cmfriend00000000000000001';
const DATE = '2026-08-14';

function todoNavigation(owner: { todoOwnerId?: string; todoDate?: string } = {}) {
  return { kind: 'TODO', todoId: 42, ...owner } satisfies NotificationNavigation;
}

function todoCommentNavigation(owner: { todoOwnerId?: string; todoDate?: string } = {}) {
  return {
    kind: 'TODO_COMMENT',
    todoId: 42,
    commentId: COMMENT_ID,
    threadCommentId: COMMENT_ID,
    activityKind: 'REPLY',
    ...owner,
  } satisfies NotificationNavigation;
}

describe('toNotificationDestination', () => {
  it('서버가 목적지를 싣지 못한 알림은 알림함을 연다', () => {
    // When
    const destination = toNotificationDestination(undefined, { windowSizeClass: 'compact' });

    // Then
    expect(destination).toEqual({ kind: 'route', href: '/notifications' });
  });

  it('접힌 화면은 주인·날짜가 있어도 할 일 상세 화면을 연다', () => {
    // When
    const destination = toNotificationDestination(
      todoNavigation({ todoOwnerId: FRIEND, todoDate: DATE }),
      { windowSizeClass: 'compact', viewerId: VIEWER },
    );

    // Then
    expect(destination).toEqual({
      kind: 'route',
      href: { pathname: '/todo/[todoId]', params: { todoId: 42 } },
    });
  });

  it.each(['medium', 'expanded'] as const)('%s 화면은 할 일을 피드 상세 pane에 고른다', (size) => {
    // When
    const todo = toNotificationDestination(todoNavigation(), { windowSizeClass: size });
    const comment = toNotificationDestination(todoCommentNavigation(), { windowSizeClass: size });

    // Then
    expect(todo).toEqual({ kind: 'route', href: { pathname: '/feed', params: { todoId: 42 } } });
    expect(comment).toEqual({
      kind: 'route',
      href: { pathname: '/feed', params: { todoId: 42, comment: COMMENT_ID } },
    });
  });

  it.each([
    [
      '친구 할 일 댓글은 그 친구의 그 날짜 피드',
      todoCommentNavigation({ todoOwnerId: FRIEND, todoDate: DATE }),
      VIEWER,
      { friendId: FRIEND, date: DATE, todoId: 42, comment: COMMENT_ID },
    ],
    [
      '친구 할 일은 그 친구의 그 날짜 피드',
      todoNavigation({ todoOwnerId: FRIEND, todoDate: DATE }),
      VIEWER,
      { friendId: FRIEND, date: DATE, todoId: 42 },
    ],
    [
      '내 할 일은 내 피드의 그 날짜',
      todoNavigation({ todoOwnerId: VIEWER, todoDate: DATE }),
      VIEWER,
      { date: DATE, todoId: 42 },
    ],
    [
      '나를 모르면 친구로 단정하지 않고 날짜만 맞춘다',
      todoNavigation({ todoOwnerId: FRIEND, todoDate: DATE }),
      undefined,
      { date: DATE, todoId: 42 },
    ],
    ['주인·날짜가 없으면 피드의 기본 날짜', todoNavigation(), VIEWER, { todoId: 42 }],
  ] as const)('펼친 화면 목록 pane: %s', (_case, navigation, viewerId, params) => {
    // When
    const destination = toNotificationDestination(navigation, {
      windowSizeClass: 'medium',
      viewerId,
    });

    // Then
    expect(destination).toEqual({ kind: 'route', href: { pathname: '/feed', params } });
  });
});

describe('isViewingNotificationDestination', () => {
  const TODO_42: NotificationDestination = {
    kind: 'route',
    href: { pathname: '/todo/[todoId]', params: { todoId: 42, comment: COMMENT_ID } },
  };
  const FRIEND_FEED_TODO_42: NotificationDestination = {
    kind: 'route',
    href: { pathname: '/feed', params: { friendId: 'friend-1', date: 'today', todoId: 42 } },
  };

  it.each([
    [
      '같은 할 일 상세면 댓글 위치가 달라도 이미 보고 있는 것이다',
      TODO_42,
      '/todo/42',
      { todoId: '42' },
      true,
    ],
    ['다른 할 일 상세면 보고 있지 않은 것이다', TODO_42, '/todo/7', { todoId: '7' }, false],
    [
      '펼친 화면의 같은 친구 피드 같은 할 일이면 날짜가 달라도 보고 있는 것이다',
      FRIEND_FEED_TODO_42,
      '/feed',
      { friendId: 'friend-1', date: '2026-11-10', todoId: '42' },
      true,
    ],
    [
      '펼친 화면이라도 친구가 아닌 내 피드면 보고 있지 않은 것이다',
      FRIEND_FEED_TODO_42,
      '/feed',
      { todoId: '42' },
      false,
    ],
    [
      '알림함이면 알림함 목적지를 보고 있는 것이다',
      { kind: 'route', href: '/notifications' },
      '/notifications',
      {},
      true,
    ],
    [
      '외부 링크는 앱 화면이 아니라 보고 있을 수 없다',
      { kind: 'browser', url: 'https://aido.app' },
      '/feed',
      {},
      false,
    ],
  ] as const)('%s', (_case, destination, pathname, params, expected) => {
    // When
    const isViewing = isViewingNotificationDestination(destination, { pathname, params });

    // Then
    expect(isViewing).toBe(expected);
  });
});
