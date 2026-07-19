export interface NotificationEventMap {
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
}
