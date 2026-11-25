import {
  createPushNotification,
  createPushNotificationResponse,
} from '../__tests__/notification.fixtures';
import { toPushNotificationOpenedEvent } from './push-notification-analytics';

describe('toPushNotificationOpenedEvent', () => {
  it('이 앱이 모르는 종류는 UNKNOWN으로 보내고 빈 캠페인 칸은 싣지 않는다', () => {
    // Given
    const response = createPushNotificationResponse({
      isLaunchResponse: true,
      notification: createPushNotification({ type: null, campaignKey: '', variantId: null }),
    });

    // When
    const event = toPushNotificationOpenedEvent(response);

    // Then
    expect(event).toEqual({ type: 'UNKNOWN', action: 'DEEP_LINK', app_state: 'cold' });
  });

  it('서버가 실은 캠페인·실험·목적 칸은 그대로 보낸다', () => {
    // Given
    const response = createPushNotificationResponse({
      notification: createPushNotification({
        type: 'ADMIN_BROADCAST',
        campaignKey: 'spring',
        variantId: 'B',
        purpose: 'ENGAGEMENT',
      }),
    });

    // When
    const event = toPushNotificationOpenedEvent(response);

    // Then
    expect(event).toEqual({
      type: 'ADMIN_BROADCAST',
      action: 'DEEP_LINK',
      app_state: 'background',
      campaign_key: 'spring',
      variant_id: 'B',
      purpose: 'ENGAGEMENT',
    });
  });
});
