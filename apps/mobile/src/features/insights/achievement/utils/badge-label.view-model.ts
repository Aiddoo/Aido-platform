import type { BadgeType } from '../domains/weekly-achievement.model';

const BADGE_NAME_KEYS = {
  perfect: 'badgeNames.perfect',
  almost: 'badgeNames.almost',
  completed: 'badgeNames.completed',
} as const satisfies Record<BadgeType, string>;

export function getBadgeNameKey(badgeType: BadgeType) {
  return BADGE_NAME_KEYS[badgeType];
}
