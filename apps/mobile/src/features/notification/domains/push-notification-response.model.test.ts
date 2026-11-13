import { fromEpochMs } from '@src/shared/date/instant';

import { createPushNotificationResponse } from '../__tests__/notification.fixtures';
import {
  hasHandledResponse,
  PushNotificationResponsePolicy,
  rememberHandledResponse,
} from './push-notification-response.model';

describe('PushNotificationResponsePolicy.isMarketingOptOut', () => {
  it.each([
    ['MARKETING_OPT_OUT', true],
    ['expo.modules.notifications.actions.DEFAULT', false],
  ])('%s 버튼 응답이 수신 거부인지는 %s다', (actionIdentifier, expected) => {
    // Given
    const response = createPushNotificationResponse({ actionIdentifier });

    // When
    const result = PushNotificationResponsePolicy.isMarketingOptOut(response);

    // Then
    expect(result).toBe(expected);
  });
});

describe('PushNotificationResponsePolicy.getResponseAction', () => {
  const NOW_MS = 1_000_000_000;
  const NOW = fromEpochMs(NOW_MS);
  const DEFAULT_TAP = createPushNotificationResponse({ receivedAt: NOW });

  it.each(['loading', 'locked'] as const)(
    '%s 상태에서는 계정 알림 처리를 인증 판정 뒤로 미룬다',
    (authStatus) => {
      // When
      const action = PushNotificationResponsePolicy.getResponseAction(DEFAULT_TAP, {
        authStatus,
        now: NOW,
      });

      // Then
      expect(action).toEqual({ type: 'defer', reason: 'auth-resolving' });
    },
  );

  it('미인증이면 로그인할 때까지 보관한다', () => {
    // When
    const action = PushNotificationResponsePolicy.getResponseAction(DEFAULT_TAP, {
      authStatus: 'unauthenticated',
      now: NOW,
    });

    // Then
    expect(action).toEqual({ type: 'defer', reason: 'authentication-required' });
  });

  it('인증됐으면 연다', () => {
    // When
    const action = PushNotificationResponsePolicy.getResponseAction(DEFAULT_TAP, {
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
      const action = PushNotificationResponsePolicy.getResponseAction(optOutTap, {
        authStatus,
        now: NOW,
      });

      // Then
      expect(action).toEqual({ type: 'optOut' });
    },
  );

  it('받은 지 정확히 10분이 지난 응답은 아직 연다', () => {
    // When
    const action = PushNotificationResponsePolicy.getResponseAction(DEFAULT_TAP, {
      authStatus: 'authenticated',
      now: fromEpochMs(NOW_MS + 10 * 60_000),
    });

    // Then
    expect(action).toEqual({ type: 'open' });
  });

  it('10분에서 1ms가 더 지난 응답은 버린다', () => {
    // When
    const action = PushNotificationResponsePolicy.getResponseAction(DEFAULT_TAP, {
      authStatus: 'authenticated',
      now: fromEpochMs(NOW_MS + 10 * 60_000 + 1),
    });

    // Then
    expect(action).toEqual({ type: 'drop', reason: 'expired' });
  });
});

describe('PushNotificationResponsePolicy.getOpenAppState', () => {
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
      const response = createPushNotificationResponse({
        isLaunchResponse,
        appState,
        activeSince: activeSince == null ? null : fromEpochMs(activeSince),
        receivedAt: fromEpochMs(receivedAt),
      });

      // When
      const openedFrom = PushNotificationResponsePolicy.getOpenAppState(response);

      // Then
      expect(openedFrom).toBe(expected);
    },
  );
});

describe('rememberHandledResponse', () => {
  it('처리한 응답은 다른 탭이 끼어도 다시 처리하지 않는다', () => {
    // Given
    const handledResponseIds = ['a', 'b'].reduce(rememberHandledResponse, []);

    // When
    const hasHandled = hasHandledResponse(handledResponseIds, 'a');

    // Then
    expect(hasHandled).toBe(true);
  });

  it('최근 20개만 기억해 앱을 오래 써도 기억이 늘지 않는다', () => {
    // Given
    const responseIds = Array.from({ length: 21 }, (_, index) => `response-${index}`);

    // When
    const handledResponseIds = responseIds.reduce(rememberHandledResponse, []);

    // Then
    expect(handledResponseIds).toHaveLength(20);
    expect(hasHandledResponse(handledResponseIds, 'response-0')).toBe(false);
    expect(hasHandledResponse(handledResponseIds, 'response-20')).toBe(true);
  });
});
