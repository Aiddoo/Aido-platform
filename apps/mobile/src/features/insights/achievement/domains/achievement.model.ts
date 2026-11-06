import type { WeeklyAchievement } from '../schemas/achievement.schema';

export const BadgeType = {
  perfect: 'perfect',
  almost: 'almost',
  completed: 'completed',
} as const;
export type BadgeType = (typeof BadgeType)[keyof typeof BadgeType];

const PERFECT_COMPLETION_RATE = 100;
const ALMOST_COMPLETION_RATE = 90;

/** 완료율 100%는 빈틈없는 한 주, 90% 이상은 아깝다 한 끗, 나머지는 꾸준한 한 걸음 */
function getBadgeType(achievement: Pick<WeeklyAchievement, 'completionRate'>): BadgeType {
  if (achievement.completionRate >= PERFECT_COMPLETION_RATE) {
    return BadgeType.perfect;
  }
  if (achievement.completionRate >= ALMOST_COMPLETION_RATE) {
    return BadgeType.almost;
  }
  return BadgeType.completed;
}

export const AchievementPolicy = {
  getBadgeType,
} as const;
