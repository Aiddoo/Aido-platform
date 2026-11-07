import type { BadgeType } from '../schemas/achievement.schema';

export const ACHIEVEMENT_BADGE_NAME_KEYS = {
  perfect: 'badgeNames.perfect',
  almost: 'badgeNames.almost',
  completed: 'badgeNames.completed',
} as const satisfies Record<BadgeType, string>;
