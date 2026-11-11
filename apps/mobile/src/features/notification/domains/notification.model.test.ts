import { toInstant } from '@src/shared/date/instant';

import {
  createPendingNotificationResponse,
  createPushNotificationPayload,
} from '../__tests__/notification.fixtures';
import type { Notification } from './notification.model';
import {
  HandledResponsePolicy,
  NotificationPolicy,
  NotificationResponsePolicy,
  PushNotificationPolicy,
} from './notification.model';

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
    const notification = { ...baseNotification, type };

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
  const DEFAULT_TAP = createPendingNotificationResponse({ receivedAt: NOW });

  it.each(['loading', 'locked'] as const)(
    '%s 상태에서는 계정 알림 처리를 인증 판정 뒤로 미룬다',
    (authStatus) => {
      // When
      const action = NotificationResponsePolicy.getResponseAction(DEFAULT_TAP, {
        authStatus,
        now: NOW,
      });

      // Then
      expect(action).toEqual({ type: 'defer', reason: 'auth-resolving' });
    },
  );

  it('미인증이면 로그인할 때까지 보관한다', () => {
    // When
    const action = NotificationResponsePolicy.getResponseAction(DEFAULT_TAP, {
      authStatus: 'unauthenticated',
      now: NOW,
    });

    // Then
    expect(action).toEqual({ type: 'defer', reason: 'authentication-required' });
  });

  it('인증됐으면 연다', () => {
    // When
    const action = NotificationResponsePolicy.getResponseAction(DEFAULT_TAP, {
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
      const action = NotificationResponsePolicy.getResponseAction(optOutTap, {
        authStatus,
        now: NOW,
      });

      // Then
      expect(action).toEqual({ type: 'optOut' });
    },
  );

  it('받은 지 정확히 10분이 지난 응답은 아직 연다', () => {
    // When
    const action = NotificationResponsePolicy.getResponseAction(DEFAULT_TAP, {
      authStatus: 'authenticated',
      now: NOW + 10 * 60_000,
    });

    // Then
    expect(action).toEqual({ type: 'open' });
  });

  it('10분에서 1ms가 더 지난 응답은 버린다', () => {
    // When
    const action = NotificationResponsePolicy.getResponseAction(DEFAULT_TAP, {
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
    const result = PushNotificationPolicy.hasServerRecord(
      createPushNotificationPayload({ notificationId }),
    );

    // Then
    expect(result).toBe(expected);
  });
});

describe('getForegroundPresentation', () => {
  it.each([
    [
      '알림함을 보고 있으면',
      'FOLLOW_NEW',
      { isViewingInbox: true, isViewingDestination: false },
      'quiet',
    ],
    [
      '받을 때 다시 받는 화면(콕)을 보고 있으면',
      'NUDGE_RECEIVED',
      { isViewingInbox: false, isViewingDestination: true },
      'quiet',
    ],
    [
      '다시 받지 않는 화면(공유한 할 일)을 보고 있으면',
      'TODO_SHARED',
      { isViewingInbox: false, isViewingDestination: true },
      'banner',
    ],
    [
      '다른 화면을 보고 있으면',
      'NUDGE_RECEIVED',
      { isViewingInbox: false, isViewingDestination: false },
      'banner',
    ],
    [
      '모르는 타입은 알림함을 보고 있어도',
      null,
      { isViewingInbox: true, isViewingDestination: true },
      'banner',
    ],
  ] as const)('%s(%s) %s로 보인다', (_case, type, viewing, expected) => {
    // Given
    const payload = createPushNotificationPayload({ type });

    // When
    const presentation = PushNotificationPolicy.getForegroundPresentation(payload, viewing);

    // Then
    expect(presentation).toBe(expected);
  });
});

describe('getOpenAppState', () => {
  const ACTIVE_SINCE = 10_000;

  it.each([
    ['꺼진 앱이 그 탭으로 켜졌으면', 'cold', true, 'active', ACTIVE_SINCE, ACTIVE_SINCE + 5_000],
    ['뒤에 있던 앱이면', 'background', false, 'background', null, ACTIVE_SINCE],
    // 응답이 복귀 이벤트보다 늦게 와도 1초 안이면 뒤에서 누른 탭이다
    [
      '앞으로 온 지 1초가 안 됐으면',
      'background',
      false,
      'active',
      ACTIVE_SINCE,
      ACTIVE_SINCE + 999,
    ],
    ['앞에 1초 이상 있었으면', 'foreground', false, 'active', ACTIVE_SINCE, ACTIVE_SINCE + 1_000],
  ] as const)(
    '%s 열림을 %s로 남긴다',
    (_case, expected, isLaunchResponse, appState, activeSince, receivedAt) => {
      // Given
      const response = createPendingNotificationResponse({
        isLaunchResponse,
        appState,
        activeSince,
        receivedAt,
      });

      // When
      const openedFrom = NotificationResponsePolicy.getOpenAppState(response);

      // Then
      expect(openedFrom).toBe(expected);
    },
  );
});

describe('HandledResponsePolicy', () => {
  it('처리한 응답은 다른 탭이 끼어도 다시 처리하지 않는다', () => {
    // Given
    const handledResponseIds = ['a', 'b'].reduce(HandledResponsePolicy.rememberHandledResponse, []);

    // When
    const hasHandled = HandledResponsePolicy.hasHandledResponse(handledResponseIds, 'a');

    // Then
    expect(hasHandled).toBe(true);
  });

  it('최근 20개만 기억해 앱을 오래 써도 기억이 늘지 않는다', () => {
    // Given
    const responseIds = Array.from({ length: 21 }, (_, index) => `response-${index}`);

    // When
    const handledResponseIds = responseIds.reduce(
      HandledResponsePolicy.rememberHandledResponse,
      [],
    );

    // Then
    expect(handledResponseIds).toHaveLength(20);
    expect(HandledResponsePolicy.hasHandledResponse(handledResponseIds, 'response-0')).toBe(false);
    expect(HandledResponsePolicy.hasHandledResponse(handledResponseIds, 'response-20')).toBe(true);
  });
});
