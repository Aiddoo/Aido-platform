import { createPushNotification } from '../__tests__/notification.fixtures';
import {
  createUnreadablePushNotification,
  PushNotificationPolicy,
} from './push-notification.model';

describe('PushNotificationPolicy.hasServerRecord', () => {
  it.each([
    { title: '알림 ID가 0이면 서버 기록이 없는 푸시다', notificationId: 0, expected: false },
    { title: '알림 ID가 1이면 서버 기록이 있다', notificationId: 1, expected: true },
    { title: '알림 ID가 있으면 서버 기록이 있다', notificationId: 7, expected: true },
  ])('$title', ({ notificationId, expected }) => {
    // When
    const result = PushNotificationPolicy.hasServerRecord(
      createPushNotification({ notificationId }),
    );

    // Then
    expect(result).toBe(expected);
  });
});

describe('createUnreadablePushNotification', () => {
  it('읽지 못한 푸시는 서버에 묻지 않고 알림함으로 연다', () => {
    // When
    const pushNotification = createUnreadablePushNotification();

    // Then
    expect(PushNotificationPolicy.hasServerRecord(pushNotification)).toBe(false);
    expect(pushNotification.type).toBeNull();
    expect(pushNotification.target).toEqual({ kind: 'NOTIFICATIONS' });
  });
});
