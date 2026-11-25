import type { AppEventMap } from '@src/shared/analytics/event-map';

import {
  type PushNotificationResponse,
  PushNotificationResponsePolicy,
} from '../domains/push-notification-response.model';

/** 연 푸시의 분석 값. 개인 정보는 싣지 않고, 캠페인 칸은 서버가 실었을 때만 보낸다 */
export function toPushNotificationOpenedEvent(
  response: PushNotificationResponse,
): AppEventMap['push_notification_opened'] {
  const { notification } = response;
  return {
    type: notification.type ?? 'UNKNOWN',
    action: notification.actionType,
    app_state: PushNotificationResponsePolicy.getOpenAppState(response),
    ...(notification.campaignKey && { campaign_key: notification.campaignKey }),
    ...(notification.variantId && { variant_id: notification.variantId }),
    ...(notification.purpose && { purpose: notification.purpose }),
  };
}
