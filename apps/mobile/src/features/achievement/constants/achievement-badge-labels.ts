import type { BadgeType } from '../domains/achievement.model';

export const ACHIEVEMENT_BADGE_NAME_KEYS = {
  perfect: 'achievement:badgeNames.perfect',
  almost: 'achievement:badgeNames.almost',
  completed: 'achievement:badgeNames.completed',
} as const satisfies Record<BadgeType, string>;
