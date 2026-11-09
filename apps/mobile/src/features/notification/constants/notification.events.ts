import type { TimezoneOffsetBucket } from '../domains/device-timezone.model';

export type PushPermissionPromptSource =
  | 'onboarding'
  | 'todo_time'
  | 'feed_card'
  | 'settings'
  | 'paywall';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    push_notification_opened: {
      type: string;
      action: string;
      campaign_key?: string;
      variant_id?: string;
      purpose?: string;
    };
    notification_center_opened: { type: string; destination: string };
    marketing_push_opted_out: { source: 'push_action' };
    marketing_push_opted_in: { source: 'completion_sheet' };
    marketing_push_prompt_shown: { source: 'completion_sheet' };
    marketing_push_prompt_dismissed: { source: 'completion_sheet' };
    push_permission_prompt_shown: { source: PushPermissionPromptSource; step: string };
    push_permission_prompt_dismissed: { source: PushPermissionPromptSource; step: string };
    push_permission_requested: { source: PushPermissionPromptSource; status: string };
    push_permission_settings_opened: { source: PushPermissionPromptSource };
    /** 시간대 이름·도시는 보내지 않고 바뀐 폭만 보낸다. 여행 빈도와 기기 예약 전환 판단에 쓴다. */
    device_timezone_changed: {
      offset_bucket: TimezoneOffsetBucket;
      notice_shown: boolean;
    };
  }
}
