import { type Notification, NotificationPolicy } from './notification.model';

const baseNotification: Notification = {
  id: 1,
  userId: 'cmreceiver000000000000001',
  type: 'CHEER_RECEIVED',
  title: '응원이 도착했어요',
  body: '오늘도 화이팅!',
  isRead: false,
  context: { cheerId: 7, friendId: 'cmsender0000000000000001' },
  routing: { senderId: 'cmsender0000000000000001', senderName: '지윤' },
  createdAt: new Date('2026-10-26T09:00:00.000Z'),
  readAt: null,
};

describe('NotificationPolicy.findReceivedCheer', () => {
  test('받은 응원 알림은 신고할 응원과 보낸 친구를 돌려준다', () => {
    // When
    const cheer = NotificationPolicy.findReceivedCheer(baseNotification);

    // Then
    expect(cheer).toEqual({
      cheerId: 7,
      senderId: 'cmsender0000000000000001',
      senderName: '지윤',
    });
  });

  test('보낸 사람 이름이 없는 이전 알림은 이름 없이 돌려준다', () => {
    // Given
    const legacy: Notification = { ...baseNotification, routing: undefined };

    // When & Then
    expect(NotificationPolicy.findReceivedCheer(legacy)?.senderName).toBeNull();
  });

  test('응원 ID가 없는 이전 알림이나 다른 종류의 알림은 신고 대상이 아니다', () => {
    // Given
    const legacyCheer: Notification = { ...baseNotification, context: { friendId: 'cmsender' } };
    const nudge: Notification = { ...baseNotification, type: 'NUDGE_RECEIVED' };

    // When & Then
    expect(NotificationPolicy.findReceivedCheer(legacyCheer)).toBeNull();
    expect(NotificationPolicy.findReceivedCheer(nudge)).toBeNull();
  });
});

describe('NotificationPolicy.getResponseAction', () => {
  test.each(['loading', 'locked'] as const)(
    '%s 상태에서는 계정 알림 처리를 인증 판정 뒤로 미룬다',
    (authStatus) => {
      expect(
        NotificationPolicy.getResponseAction({
          authStatus,
          actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
        }),
      ).toEqual({ status: 'defer', reason: 'auth-resolving' });
    },
  );

  test('인증된 사용자의 알림은 처리한다', () => {
    expect(
      NotificationPolicy.getResponseAction({
        authStatus: 'authenticated',
        actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
      }),
    ).toEqual({ status: 'process' });
  });

  test('미인증 사용자의 계정 알림은 로그인할 때까지 기다린다', () => {
    expect(
      NotificationPolicy.getResponseAction({
        authStatus: 'unauthenticated',
        actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
      }),
    ).toEqual({ status: 'defer', reason: 'authentication-required' });
  });

  test('공개 수신 거부 액션은 인증 상태와 무관하게 처리한다', () => {
    expect(
      NotificationPolicy.getResponseAction({
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
  const result = NotificationPolicy.getResponseAction(input);
  // Then
  expect(result).toEqual({ status: 'defer', reason: 'navigation-not-ready' });
});
