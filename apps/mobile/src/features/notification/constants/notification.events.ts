import type { TimezoneOffsetBucket } from '../domains/device-timezone.model';

export type PushPermissionPromptSource = 'activation' | 'feed_card' | 'settings';

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
    marketing_push_opted_in: { source: 'feed_banner' };
    marketing_push_prompt_dismissed: { source: 'feed_banner' };
    push_permission_prompt_shown: { source: PushPermissionPromptSource; step: string };
    push_permission_prompt_dismissed: { source: PushPermissionPromptSource; step: string };
    push_permission_requested: { source: PushPermissionPromptSource; status: string };
    push_permission_settings_opened: { source: PushPermissionPromptSource };
    device_timezone_changed: {
      offset_bucket: TimezoneOffsetBucket;
      notice_shown: boolean;
    };
  }
}
