import type { TimezoneOffsetBucket } from '../domains/device-timezone.model';
import type { Notification } from '../domains/notification.model';
import type { PushOpenAppState } from '../domains/push-notification-response.model';
import type { PushNotification } from '../domains/push-notification.model';
import type { PushPermission, PushPermissionStep } from '../domains/push-permission.model';
import type { NotificationDestination } from '../utils/notification-destination.view-model';

export type PushPermissionPromptSource =
  | 'onboarding'
  | 'todo_time'
  | 'feed_card'
  | 'settings'
  | 'paywall'
  | 'invite_welcome';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    push_notification_opened: {
      /** 이 앱이 모르는 새 종류면 UNKNOWN이다 */
      type: NonNullable<PushNotification['type']> | 'UNKNOWN';
      action: PushNotification['actionType'];
      /** 꺼진 앱(cold)·뒤에 있던 앱·쓰는 중 앱에서 누른 탭을 나눠 재방문을 만든 열림을 센다 */
      app_state: PushOpenAppState;
      campaign_key?: NonNullable<PushNotification['campaignKey']>;
      variant_id?: NonNullable<PushNotification['variantId']>;
      purpose?: NonNullable<PushNotification['purpose']>;
    };
    notification_center_opened: {
      type: Notification['type'];
      destination: NotificationDestination['kind'];
    };
    marketing_push_opted_out: { source: 'push_action' };
    marketing_push_opted_in: { source: 'completion_sheet' };
    marketing_push_prompt_shown: { source: 'completion_sheet' };
    marketing_push_prompt_dismissed: { source: 'completion_sheet' };
    push_permission_prompt_shown: { source: PushPermissionPromptSource; step: PushPermissionStep };
    push_permission_prompt_dismissed: {
      source: PushPermissionPromptSource;
      step: PushPermissionStep;
    };
    push_permission_requested: {
      source: PushPermissionPromptSource;
      status: PushPermission['status'];
    };
    push_permission_settings_opened: { source: PushPermissionPromptSource };
    /** 시간대 이름·도시는 보내지 않고 바뀐 폭만 보낸다. 여행 빈도와 기기 예약 전환 판단에 쓴다. */
    device_timezone_changed: {
      offset_bucket: TimezoneOffsetBucket;
      notice_shown: boolean;
    };
  }
}
