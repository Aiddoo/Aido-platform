import { createNotificationListResponseDto } from '../../__tests__/notification.factories';
import { toNotification } from '../../services/notification.mapper';
import { resolveNotificationDestination } from './notification-destination';

const COMMENT_ID = 'cmt92zn3n000b7voxx9quc2th';

describe('resolveNotificationDestination', () => {
  test('댓글 routing은 할 일 대화 화면의 focus로 이동한다', () => {
    expect(
      resolveNotificationDestination({
        type: 'TODO_SHARED',
        context: { todoId: 42 },
        routing: { commentId: COMMENT_ID },
        action: { type: 'DEEP_LINK' },
      }),
    ).toEqual({
      kind: 'route',
      href: {
        pathname: '/todo/[todoId]',
        params: { todoId: 42, comment: COMMENT_ID },
      },
    });
  });

  test('알림 목록 metadata와 푸시 routing은 같은 댓글 목적지로 해석한다', () => {
    const server = createNotificationListResponseDto().notifications[0];
    if (!server) {
      throw new Error('Expected notification DTO');
    }
    const notification = toNotification({
      ...server,
      type: 'TODO_SHARED',
      context: { todoId: 42 },
      metadata: {
        commentId: COMMENT_ID,
        type: 'FOLLOW_ACCEPTED',
        todoId: 999,
      },
    });

    const fromNotificationList = resolveNotificationDestination({
      type: notification.type,
      context: notification.context,
      routing: notification.routing,
      action: notification.action,
    });
    const fromPush = resolveNotificationDestination({
      type: 'TODO_SHARED',
      context: { todoId: 42 },
      routing: { commentId: COMMENT_ID },
      action: { type: 'DEEP_LINK' },
    });

    expect(fromNotificationList).toEqual(fromPush);
    expect(fromNotificationList).toEqual({
      kind: 'route',
      href: {
        pathname: '/todo/[todoId]',
        params: { todoId: 42, comment: COMMENT_ID },
      },
    });
  });

  test('댓글이 없으면 할 일 상세로 이동한다', () => {
    expect(
      resolveNotificationDestination({ type: 'TODO_SHARED', context: { todoId: 42 } }),
    ).toEqual({ kind: 'route', href: { pathname: '/todo/[todoId]', params: { todoId: 42 } } });
  });

  test('이동 재료가 부족한 과거 알림은 이동하지 않는다', () => {
    expect(resolveNotificationDestination({ type: 'TODO_SHARED' })).toEqual({ kind: 'none' });
  });

  test('NONE 액션은 기본 경로가 있어도 이동하지 않는다', () => {
    expect(
      resolveNotificationDestination({
        type: 'MORNING_REMINDER',
        action: { type: 'NONE' },
      }),
    ).toEqual({ kind: 'none' });
  });

  test.each([
    ['BROWSER' as const, 'browser'],
    ['WEBVIEW' as const, 'webview'],
  ])('%s 액션을 외부 목적지로 해석한다', (actionType, kind) => {
    expect(
      resolveNotificationDestination({
        type: 'SYSTEM_NOTICE',
        action: { type: actionType, url: 'https://aido.app/news' },
      }),
    ).toEqual({ kind, url: 'https://aido.app/news' });
  });

  test('웹 주소가 아닌 외부 URL은 열지 않는다', () => {
    expect(
      resolveNotificationDestination({
        type: 'SYSTEM_NOTICE',
        action: { type: 'BROWSER', url: 'javascript:alert(1)' },
      }),
    ).toEqual({ kind: 'none' });
  });

  test('DEEP_LINK URL 대신 타입과 검증된 재료로 이동한다', () => {
    expect(
      resolveNotificationDestination({
        type: 'FOLLOW_ACCEPTED',
        context: { friendId: 'friend-1' },
        action: { type: 'DEEP_LINK', url: '/anything/the/server/says' },
      }),
    ).toEqual({
      kind: 'route',
      href: { pathname: '/feed/friend/[friendId]', params: { friendId: 'friend-1' } },
    });
  });

  test('피드 알림은 별도 routing 없이 이동한다', () => {
    expect(resolveNotificationDestination({ type: 'STREAK_AT_RISK' })).toEqual({
      kind: 'route',
      href: '/feed',
    });
  });
});
