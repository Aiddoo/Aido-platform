import { fromEpochMs } from '@src/shared/date/instant';

import { PushNotificationPolicy } from '../domains/push-notification.model';
import { parsePushNotificationResponse } from './push-notification-response.mapper';

const BODY_TAP = 'expo.modules.notifications.actions.DEFAULT';
const CONTEXT = {
  receivedAt: fromEpochMs(0),
  isLaunchResponse: false,
  appState: 'active',
  activeSince: null,
} as const;
const DATA = {
  notificationId: 7,
  type: 'NUDGE_RECEIVED',
  action: { type: 'DEEP_LINK' },
  navigation: { kind: 'NUDGE', nudgeId: 3 },
};

describe('parsePushNotificationResponse', () => {
  it('같은 알림이어도 버튼과 본문 탭은 다른 응답이고, 같은 알림의 같은 동작은 같은 응답이다', () => {
    // Given
    const notificationIdentifier = 'notification-42';

    // When
    const button = parsePushNotificationResponse(
      { id: notificationIdentifier, actionIdentifier: 'complete', data: DATA },
      CONTEXT,
    );
    const body = parsePushNotificationResponse(
      { id: notificationIdentifier, actionIdentifier: BODY_TAP, data: DATA },
      CONTEXT,
    );
    const redelivered = parsePushNotificationResponse(
      { id: notificationIdentifier, actionIdentifier: BODY_TAP, data: DATA },
      CONTEXT,
    );

    // Then
    expect(body.response.id).not.toBe(button.response.id);
    expect(redelivered.response.id).toBe(body.response.id);
    expect(body.response.notificationIdentifier).toBe(notificationIdentifier);
  });

  it('읽지 못한 푸시는 서버에 묻지 않고 알림함으로 연다', () => {
    // When
    const { response, isReadable } = parsePushNotificationResponse(
      { id: 'notification-1', actionIdentifier: BODY_TAP, data: 'broken' },
      CONTEXT,
    );

    // Then
    expect(isReadable).toBe(false);
    expect(PushNotificationPolicy.hasServerRecord(response.notification)).toBe(false);
    expect(response.notification.type).toBeNull();
    expect(response.notification.target).toEqual({ kind: 'NOTIFICATIONS' });
  });

  it('틀린 칸만 버린 푸시는 읽은 것으로 보고 버린 경로를 돌려준다', () => {
    // When
    const { response, isReadable, droppedPaths } = parsePushNotificationResponse(
      { id: 'notification-1', actionIdentifier: BODY_TAP, data: { ...DATA, type: 'NEW_KIND' } },
      CONTEXT,
    );

    // Then
    expect(isReadable).toBe(true);
    expect(droppedPaths).toEqual(['type']);
    expect(response.notification.target).toEqual({ kind: 'NUDGE', nudgeId: 3 });
  });
});
