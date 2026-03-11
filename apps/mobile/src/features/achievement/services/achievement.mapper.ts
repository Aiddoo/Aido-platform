import type {
  WeeklyAchievementSummary as SummaryDto,
  WeeklyAchievementDto,
  WeeklyAchievementListResponse,
} from '@aido/validators';

import type {
  AchievementSummary,
  WeeklyAchievement,
  WeeklyAchievementsResult,
} from '../models/achievement.model';

export const toWeeklyAchievement = (dto: WeeklyAchievementDto): WeeklyAchievement => ({
  id: dto.id,
  year: dto.year,
  week: dto.week,
  weekLabel: dto.weekLabel,
  dateRange: dto.dateRange,
  totalTodos: dto.totalTodos,
  completedTodos: dto.completedTodos,
  completionRate: dto.completionRate,
  achievedAt: new Date(dto.achievedAt),
});

export const toAchievementSummary = (dto: SummaryDto): AchievementSummary => ({
  totalWeeks: dto.totalWeeks,
  perfectWeeks: dto.perfectWeeks,
  currentStreak: dto.currentStreak,
  bestStreak: dto.bestStreak,
  averageRate: dto.averageRate,
});

export const toWeeklyAchievementsResult = (
  dto: WeeklyAchievementListResponse,
): WeeklyAchievementsResult => ({
  items: dto.items.map(toWeeklyAchievement),
  nextCursor: dto.pagination.nextCursor,
  hasNext: dto.pagination.hasNext,
  summary: toAchievementSummary(dto.summary),
});
