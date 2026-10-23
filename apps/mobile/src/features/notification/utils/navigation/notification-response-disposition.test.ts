import { getNotificationResponseDisposition } from './notification-response-disposition';

describe('getNotificationResponseDisposition', () => {
  test.each(['loading', 'locked'] as const)(
    '%s 상태에서는 계정 알림 처리를 인증 판정 뒤로 미룬다',
    (authStatus) => {
      expect(
        getNotificationResponseDisposition({
          authStatus,
          actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
        }),
      ).toEqual({ status: 'defer', reason: 'auth-resolving' });
    },
  );

  test('인증된 사용자의 알림은 처리한다', () => {
    expect(
      getNotificationResponseDisposition({
        authStatus: 'authenticated',
        actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
      }),
    ).toEqual({ status: 'process' });
  });

  test('미인증 사용자의 계정 알림은 로그인할 때까지 기다린다', () => {
    expect(
      getNotificationResponseDisposition({
        authStatus: 'unauthenticated',
        actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
      }),
    ).toEqual({ status: 'defer', reason: 'authentication-required' });
  });

  test('공개 수신 거부 액션은 인증 상태와 무관하게 처리한다', () => {
    expect(
      getNotificationResponseDisposition({
        authStatus: 'unauthenticated',
        actionIdentifier: 'MARKETING_OPT_OUT',
      }),
    ).toEqual({ status: 'process' });
  });
});

test('인증되어도 루트 화면이 준비되지 않으면 이동을 기다린다', () => {
  // Given
  const input = {
    authStatus: 'authenticated' as const,
    actionIdentifier: 'DEFAULT',
    isNavigationReady: false,
  };
  // When
  const result = getNotificationResponseDisposition(input);
  // Then
  expect(result).toEqual({ status: 'defer', reason: 'navigation-not-ready' });
});
