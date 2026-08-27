import { resolveNotificationDestination } from './notification-destination.model';
import { toNotificationRouting } from './notification-routing.model';

const COMMENT_ID = 'cmt92zn3n000b7voxx9quc2th';

const routingFor = (type: Parameters<typeof toNotificationRouting>[0]['type'], extra = {}) =>
  toNotificationRouting({ type, context: extra });

describe('resolveNotificationDestination', () => {
  test('댓글을 지목한 알림은 할 일 대화 화면의 focus로 한 번 진입한다', () => {
    const destination = resolveNotificationDestination({
      type: 'TODO_SHARED',
      routing: toNotificationRouting({
        type: 'TODO_SHARED',
        context: { todoId: 42 },
        extra: { commentId: COMMENT_ID },
      }),
    });

    expect(destination).toEqual({
      kind: 'route',
      href: {
        pathname: '/todo/[todoId]',
        params: { todoId: 42, comment: COMMENT_ID },
      },
    });
  });

  test('지목된 댓글이 없으면 할 일 상세로 간다', () => {
    expect(
      resolveNotificationDestination({
        type: 'TODO_SHARED',
        routing: routingFor('TODO_SHARED', { todoId: 42 }),
      }),
    ).toEqual({ kind: 'route', href: { pathname: '/todo/[todoId]', params: { todoId: 42 } } });
  });

  test('재료가 모자란 옛 알림은 갈 곳이 없다 — 목록에는 남고 이동만 안 한다', () => {
    expect(
      resolveNotificationDestination({ type: 'TODO_SHARED', routing: routingFor('TODO_SHARED') }),
    ).toEqual({ kind: 'none' });
  });

  test('NONE 액션은 타입 기본 경로가 있어도 이동하지 않는다', () => {
    expect(
      resolveNotificationDestination({
        type: 'MORNING_REMINDER',
        routing: routingFor('MORNING_REMINDER'),
        action: { type: 'NONE' },
      }),
    ).toEqual({ kind: 'none' });
  });

  test.each([
    ['BROWSER' as const, 'browser'],
    ['WEBVIEW' as const, 'webview'],
  ])('%s 액션을 같은 종류의 외부 목적지로 해석한다', (actionType, kind) => {
    expect(
      resolveNotificationDestination({
        type: 'SYSTEM_NOTICE',
        routing: null,
        action: { type: actionType, url: 'https://aido.app/news' },
      }),
    ).toEqual({ kind, url: 'https://aido.app/news' });
  });

  test('웹 주소가 아닌 외부 URL은 열지 않는다', () => {
    expect(
      resolveNotificationDestination({
        type: 'SYSTEM_NOTICE',
        routing: null,
        action: { type: 'BROWSER', url: 'javascript:alert(1)' },
      }),
    ).toEqual({ kind: 'none' });
  });

  test('DEEP_LINK의 url은 라우터로 넘기지 않는다 — 길은 타입과 재료가 정한다', () => {
    expect(
      resolveNotificationDestination({
        type: 'FOLLOW_ACCEPTED',
        routing: routingFor('FOLLOW_ACCEPTED', { friendId: 'friend-1' }),
        action: { type: 'DEEP_LINK', url: '/anything/the/server/says' },
      }),
    ).toEqual({
      kind: 'route',
      href: { pathname: '/feed/friend/[friendId]', params: { friendId: 'friend-1' } },
    });
  });

  test('타입만으로 피드에 가는 알림들은 재료가 없어도 열린다', () => {
    expect(
      resolveNotificationDestination({
        type: 'STREAK_AT_RISK',
        routing: routingFor('STREAK_AT_RISK'),
      }),
    ).toEqual({ kind: 'route', href: '/feed' });
  });
});
