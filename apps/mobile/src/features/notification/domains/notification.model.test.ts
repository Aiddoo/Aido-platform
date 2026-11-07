import { toInstant } from '@src/shared/date/instant';

import { type Notification } from '../schemas/notification.schema';
import { NotificationPolicy } from './notification.model';

const baseNotification: Notification = {
  id: 1,
  userId: 'cmreceiver000000000000001',
  type: 'CHEER_RECEIVED',
  title: '응원이 도착했어요',
  body: '오늘도 화이팅!',
  isRead: false,
  context: { cheerId: 7, friendId: 'cmsender0000000000000001' },
  routing: { senderId: 'cmsender0000000000000001', senderName: '지윤' },
  createdAt: toInstant('2026-10-26T09:00:00.000Z'),
  readAt: null,
};

describe('NotificationPolicy.canSelectDirection', () => {
  it.each([
    ['SOCIAL', true, true],
    ['SOCIAL', false, false],
    ['ALL', true, false],
  ] as const)(
    '%s 알림에서 콕 상호작용 사용 가능이 %s면 방향 선택은 %s다',
    (category, isAvailable, expected) => {
      // When
      const result = NotificationPolicy.canSelectDirection(category, isAvailable);

      // Then
      expect(result).toBe(expected);
    },
  );
});

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
  const NOW = 1_000_000_000;
  const DEFAULT_TAP = {
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    receivedAt: NOW,
  };

  test.each(['loading', 'locked'] as const)(
    '%s 상태에서는 계정 알림 처리를 인증 판정 뒤로 미룬다',
    (authStatus) => {
      // When
      const action = NotificationPolicy.getResponseAction(DEFAULT_TAP, { authStatus, now: NOW });

      // Then
      expect(action).toEqual({ type: 'defer', reason: 'auth-resolving' });
    },
  );

  test('미인증이면 로그인할 때까지 보관한다', () => {
    // When
    const action = NotificationPolicy.getResponseAction(DEFAULT_TAP, {
      authStatus: 'unauthenticated',
      now: NOW,
    });

    // Then
    expect(action).toEqual({ type: 'defer', reason: 'authentication-required' });
  });

  test('인증됐으면 연다', () => {
    // When
    const action = NotificationPolicy.getResponseAction(DEFAULT_TAP, {
      authStatus: 'authenticated',
      now: NOW,
    });

    // Then
    expect(action).toEqual({ type: 'open' });
  });

  test.each(['loading', 'locked', 'unauthenticated', 'authenticated'] as const)(
    '%s 상태에서도 수신 거부는 바로 처리한다',
    (authStatus) => {
      // When
      const action = NotificationPolicy.getResponseAction(
        { ...DEFAULT_TAP, actionIdentifier: 'MARKETING_OPT_OUT' },
        { authStatus, now: NOW },
      );

      // Then
      expect(action).toEqual({ type: 'optOut' });
    },
  );

  test('10분이 지난 응답은 버린다', () => {
    // When
    const atLimit = NotificationPolicy.getResponseAction(DEFAULT_TAP, {
      authStatus: 'authenticated',
      now: NOW + 10 * 60_000,
    });
    const expired = NotificationPolicy.getResponseAction(DEFAULT_TAP, {
      authStatus: 'authenticated',
      now: NOW + 10 * 60_000 + 1,
    });

    // Then
    expect(atLimit).toEqual({ type: 'open' });
    expect(expired).toEqual({ type: 'drop', reason: 'expired' });
  });
});

describe('NotificationPolicy.getCategoryKey', () => {
  test.each([
    'INVITE_JOINED',
    'INVITE_REWARDED',
    'INVITE_PROGRESS',
    'INVITE_QUALIFY_REMINDER',
  ] as const)('초대 알림 %s는 알림함에서 친구 라벨로 보인다', (type) => {
    expect(NotificationPolicy.getCategoryKey({ type })).toBe('friend');
  });
});
