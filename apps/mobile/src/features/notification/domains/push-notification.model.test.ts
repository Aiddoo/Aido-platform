import { createPushNotificationPayload } from '../__tests__/notification.fixtures';
import { PushNotificationPolicy } from './push-notification.model';

describe('PushNotificationPolicy.hasServerRecord', () => {
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
