import type { BadgeType } from '../domains/achievement.model';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    badge_summary_viewed: {
      badge_type: BadgeType;
      completion_rate: number;
      // oxlint-disable-next-line aido/analytics-event-catalog -- 1.15.2 전환 #1400
      week_label: string;
    };
    badge_item_tapped: {
      badge_type: BadgeType;
      completion_rate: number;
      year: number;
      week: number;
    };
    badge_share_attempted: {
      badge_type: BadgeType;
      year: number;
      week: number;
    };
    badge_empty_cta_tapped: undefined;
    badge_opened_from_notification: undefined;
  }
}
