import { resolveNotificationDestination } from './notification.model';

describe('resolveNotificationDestination', () => {
  test('NONE 액션은 타입 기본 라우트가 있어도 이동하지 않는다', () => {
    expect(
      resolveNotificationDestination({
        type: 'MORNING_REMINDER',
        action: { type: 'NONE' },
      }),
    ).toEqual({ kind: 'none' });
  });

  test.each([
    [{ type: 'BROWSER' as const, url: 'https://aido.app/news' }, 'browser'],
    [{ type: 'WEBVIEW' as const, url: 'https://aido.app/terms' }, 'webview'],
  ])('%s 액션을 동일한 목적지로 해석한다', (action, kind) => {
    expect(resolveNotificationDestination({ type: 'SYSTEM_NOTICE', action })).toEqual({
      kind,
      url: action.url,
    });
  });

  test('context 기반 친구 화면을 해석한다', () => {
    expect(
      resolveNotificationDestination({
        type: 'FOLLOW_ACCEPTED',
        context: { friendId: 'friend-1' },
        action: { type: 'DEEP_LINK' },
      }),
    ).toEqual({ kind: 'internal', route: '/feed/friend/friend-1' });
  });
});
