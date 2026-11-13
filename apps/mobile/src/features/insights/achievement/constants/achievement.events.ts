import type { BadgeType } from '../domains/achievement.model';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    badge_summary_viewed: {
      badge_type: BadgeType;
      completion_rate: number;
      /** `{ISO 주 연도}-W{주}` */
      week_label: `${number}-W${number}`;
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
