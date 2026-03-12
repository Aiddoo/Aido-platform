import type { WeeklyAchievement } from '../../models/achievement.model';

export type BadgeType = 'perfect' | 'almost' | 'completed';

export function getBadgeType(completionRate: number): BadgeType {
  if (completionRate === 100) return 'perfect';
  if (completionRate >= 90) return 'almost';
  return 'completed';
}

export interface WeeklyAchievementViewModel extends WeeklyAchievement {
  badgeType: BadgeType;
}

export function toWeeklyAchievementViewModel(
  achievement: WeeklyAchievement,
): WeeklyAchievementViewModel {
  return {
    ...achievement,
    badgeType: getBadgeType(achievement.completionRate),
  };
}
