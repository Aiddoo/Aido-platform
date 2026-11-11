import type { NotificationTarget } from '../domains/notification.model';
import {
  isViewingNotificationDestination,
  type NotificationDestination,
  toNotificationDestination,
} from './notification-destination';

const COMMENT_ID = 'cmt92zn3n000b7voxx9quc2th';
const VIEWER = 'cmviewer00000000000000001';
const FRIEND = 'cmfriend00000000000000001';
const DATE = '2026-08-14';

function todoTarget({
  ownerId = null,
  dateKey = null,
}: { ownerId?: string | null; dateKey?: string | null } = {}) {
  return { kind: 'TODO', todoId: 42, ownerId, dateKey } satisfies NotificationTarget;
}

function todoCommentTarget(owner: { ownerId?: string; dateKey?: string } = {}) {
  return {
    ...todoTarget(owner),
    kind: 'TODO_COMMENT',
    commentId: COMMENT_ID,
  } satisfies NotificationTarget;
}

describe('toNotificationDestination', () => {
  it('접힌 화면은 주인·날짜가 있어도 할 일 상세 화면을 연다', () => {
    // When
    const destination = toNotificationDestination(todoTarget({ ownerId: FRIEND, dateKey: DATE }), {
      windowSizeClass: 'compact',
      viewerId: VIEWER,
    });

    // Then
    expect(destination).toEqual({
      kind: 'route',
      href: { pathname: '/todo/[todoId]', params: { todoId: 42 } },
    });
  });

  it.each(['medium', 'expanded'] as const)('%s 화면은 할 일을 피드 상세 pane에 고른다', (size) => {
    // When
    const todo = toNotificationDestination(todoTarget(), { windowSizeClass: size });
    const comment = toNotificationDestination(todoCommentTarget(), { windowSizeClass: size });

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
      todoCommentTarget({ ownerId: FRIEND, dateKey: DATE }),
      VIEWER,
      { friendId: FRIEND, date: DATE, todoId: 42, comment: COMMENT_ID },
    ],
    [
      '친구 할 일은 그 친구의 그 날짜 피드',
      todoTarget({ ownerId: FRIEND, dateKey: DATE }),
      VIEWER,
      { friendId: FRIEND, date: DATE, todoId: 42 },
    ],
    [
      '내 할 일은 내 피드의 그 날짜',
      todoTarget({ ownerId: VIEWER, dateKey: DATE }),
      VIEWER,
      { date: DATE, todoId: 42 },
    ],
    [
      '나를 모르면 친구로 단정하지 않고 날짜만 맞춘다',
      todoTarget({ ownerId: FRIEND, dateKey: DATE }),
      undefined,
      { date: DATE, todoId: 42 },
    ],
    ['주인·날짜가 없으면 피드의 기본 날짜', todoTarget(), VIEWER, { todoId: 42 }],
  ] as const)('펼친 화면 목록 pane: %s', (_case, target, viewerId, params) => {
    // When
    const destination = toNotificationDestination(target, {
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
