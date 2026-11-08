import { toInstant } from '@src/shared/date/instant';

import type { Notification } from '../schemas/notification.schema';
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

describe('isAiFeature', () => {
  it.each([
    ['WEEKLY_REPORT', true],
    ['MONTHLY_REPORT', true],
    ['AI_SUGGESTION', true],
    ['CHEER_RECEIVED', false],
    ['SYSTEM_NOTICE', false],
  ] as const)('%s 알림이 프리미엄 AI 기능인지는 %s다', (type, expected) => {
    // Given
    const notification = { type };

    // When
    const result = NotificationPolicy.isAiFeature(notification);

    // Then
    expect(result).toBe(expected);
  });
});

describe('findReceivedCheer', () => {
  it('받은 응원 알림은 신고할 응원과 보낸 친구를 반환한다', () => {
    // When
    const cheer = NotificationPolicy.findReceivedCheer(baseNotification);

    // Then
    expect(cheer).toEqual({
      cheerId: 7,
      senderId: 'cmsender0000000000000001',
      senderName: '지윤',
    });
  });

  it('보낸 사람 이름이 없는 이전 알림은 이름 없이 반환한다', () => {
    // Given
    const legacy: Notification = { ...baseNotification, routing: undefined };

    // When
    const cheer = NotificationPolicy.findReceivedCheer(legacy);

    // Then
    expect(cheer?.senderName).toBeNull();
  });

  it('응원 ID가 없는 이전 알림은 신고 대상이 아니다', () => {
    // Given
    const legacyCheer: Notification = { ...baseNotification, context: { friendId: 'cmsender' } };

    // When
    const cheer = NotificationPolicy.findReceivedCheer(legacyCheer);

    // Then
    expect(cheer).toBeNull();
  });

  it('응원이 아닌 다른 종류의 알림은 신고 대상이 아니다', () => {
    // Given
    const nudge: Notification = { ...baseNotification, type: 'NUDGE_RECEIVED' };

    // When
    const cheer = NotificationPolicy.findReceivedCheer(nudge);

    // Then
    expect(cheer).toBeNull();
  });
});

describe('getResponseAction', () => {
  const NOW = 1_000_000_000;
  const DEFAULT_TAP = {
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    receivedAt: NOW,
  };

  it.each(['loading', 'locked'] as const)(
    '%s 상태에서는 계정 알림 처리를 인증 판정 뒤로 미룬다',
    (authStatus) => {
      // When
      const action = NotificationPolicy.getResponseAction(DEFAULT_TAP, { authStatus, now: NOW });

      // Then
      expect(action).toEqual({ type: 'defer', reason: 'auth-resolving' });
    },
  );

  it('미인증이면 로그인할 때까지 보관한다', () => {
    // When
    const action = NotificationPolicy.getResponseAction(DEFAULT_TAP, {
      authStatus: 'unauthenticated',
      now: NOW,
    });

    // Then
    expect(action).toEqual({ type: 'defer', reason: 'authentication-required' });
  });

  it('인증됐으면 연다', () => {
    // When
    const action = NotificationPolicy.getResponseAction(DEFAULT_TAP, {
      authStatus: 'authenticated',
      now: NOW,
    });

    // Then
    expect(action).toEqual({ type: 'open' });
  });

  it.each(['loading', 'locked', 'unauthenticated', 'authenticated'] as const)(
    '%s 상태에서도 수신 거부는 바로 처리한다',
    (authStatus) => {
      // Given
      const optOutTap = { ...DEFAULT_TAP, actionIdentifier: 'MARKETING_OPT_OUT' };

      // When
      const action = NotificationPolicy.getResponseAction(optOutTap, { authStatus, now: NOW });

      // Then
      expect(action).toEqual({ type: 'optOut' });
    },
  );

  it('받은 지 정확히 10분이 지난 응답은 아직 연다', () => {
    // When
    const action = NotificationPolicy.getResponseAction(DEFAULT_TAP, {
      authStatus: 'authenticated',
      now: NOW + 10 * 60_000,
    });

    // Then
    expect(action).toEqual({ type: 'open' });
  });

  it('10분에서 1ms가 더 지난 응답은 버린다', () => {
    // When
    const action = NotificationPolicy.getResponseAction(DEFAULT_TAP, {
      authStatus: 'authenticated',
      now: NOW + 10 * 60_000 + 1,
    });

    // Then
    expect(action).toEqual({ type: 'drop', reason: 'expired' });
  });
});

describe('hasServerRecord', () => {
  it.each([
    { title: '알림 ID가 0이면 서버 기록이 없는 푸시다', notificationId: 0, expected: false },
    { title: '알림 ID가 1이면 서버 기록이 있다', notificationId: 1, expected: true },
    { title: '알림 ID가 있으면 서버 기록이 있다', notificationId: 7, expected: true },
  ])('$title', ({ notificationId, expected }) => {
    // When
    const result = NotificationPolicy.hasServerRecord({ notificationId });

    // Then
    expect(result).toBe(expected);
  });
});
