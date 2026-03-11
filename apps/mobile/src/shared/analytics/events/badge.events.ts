export interface BadgeEventMap {
  badge_summary_viewed: {
    badge_type: 'perfect' | 'almost' | 'completed';
    completion_rate: number;
    week_label: string;
  };
  badge_item_tapped: {
    badge_type: 'perfect' | 'almost' | 'completed';
    completion_rate: number;
    year: number;
    week: number;
  };
  badge_empty_cta_tapped: undefined;
  badge_opened_from_notification: undefined;
}
