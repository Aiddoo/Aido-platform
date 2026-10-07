export interface WeeklyAchievementRow {
  readonly id: number;
  readonly year: number;
  readonly week: number;
  readonly totalTodos: number;
  readonly completedTodos: number;
  readonly achievedAt: Date;
}

export interface WeeklyAchievementUpsert {
  readonly userId: string;
  readonly year: number;
  readonly week: number;
  readonly totalTodos: number;
  readonly completedTodos: number;
  readonly achievedAt: Date;
}

export interface WeeklyAchievementSummary {
  readonly totalWeeks: number;
  readonly perfectWeeks: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly averageRate: number;
}

export interface WeeklyAchievementRecord {
  readonly year: number;
  readonly week: number;
}

export interface StreakResult {
  readonly currentStreak: number;
  readonly bestStreak: number;
}
