import type { TimezoneOffsetBucket } from '../domains/device-timezone.model';
import type { PushOpenAppState } from '../domains/notification.model';

export type PushPermissionPromptSource =
  | 'onboarding'
  | 'todo_time'
  | 'feed_card'
  | 'settings'
  | 'paywall';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    push_notification_opened: {
      // oxlint-disable-next-line aido/analytics-event-catalog -- 1.15.2 전환 #1400
      type: string;
      // oxlint-disable-next-line aido/analytics-event-catalog -- 1.15.2 전환 #1400
      action: string;
      /** 꺼진 앱(cold)·뒤에 있던 앱·쓰는 중 앱에서 누른 탭을 나눠 재방문을 만든 열림을 센다 */
      app_state: PushOpenAppState;
      // oxlint-disable-next-line aido/analytics-event-catalog -- 1.15.2 전환 #1400
      campaign_key?: string;
      // oxlint-disable-next-line aido/analytics-event-catalog -- 1.15.2 전환 #1400
      variant_id?: string;
      // oxlint-disable-next-line aido/analytics-event-catalog -- 1.15.2 전환 #1400
      purpose?: string;
    };
    // oxlint-disable-next-line aido/analytics-event-catalog -- 1.15.2 전환 #1400
    notification_center_opened: { type: string; destination: string };
    marketing_push_opted_out: { source: 'push_action' };
    marketing_push_opted_in: { source: 'completion_sheet' };
    marketing_push_prompt_shown: { source: 'completion_sheet' };
    marketing_push_prompt_dismissed: { source: 'completion_sheet' };
    // oxlint-disable-next-line aido/analytics-event-catalog -- 1.15.2 전환 #1400
    push_permission_prompt_shown: { source: PushPermissionPromptSource; step: string };
    // oxlint-disable-next-line aido/analytics-event-catalog -- 1.15.2 전환 #1400
    push_permission_prompt_dismissed: { source: PushPermissionPromptSource; step: string };
    // oxlint-disable-next-line aido/analytics-event-catalog -- 1.15.2 전환 #1400
    push_permission_requested: { source: PushPermissionPromptSource; status: string };
    push_permission_settings_opened: { source: PushPermissionPromptSource };
    /** 시간대 이름·도시는 보내지 않고 바뀐 폭만 보낸다. 여행 빈도와 기기 예약 전환 판단에 쓴다. */
    device_timezone_changed: {
      offset_bucket: TimezoneOffsetBucket;
      notice_shown: boolean;
    };
  }
}
