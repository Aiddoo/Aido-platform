/**
 * WeeklyAchievement 모듈의 타입 정의
 */

// ============================================================================
// Service 인터페이스
// ============================================================================

export interface GetWeeklyAchievementsParams {
	userId: string;
	year: number;
	cursor?: number;
	size: number;
}

export interface GetWeeklyAchievementParams {
	userId: string;
	year: number;
	week: number;
}

// ============================================================================
// Repository 인터페이스
// ============================================================================

export interface UpsertWeeklyAchievementParams {
	userId: string;
	year: number;
	week: number;
	totalTodos: number;
	completedTodos: number;
	achievedAt: Date;
}

// ============================================================================
// Mapper 인터페이스
// ============================================================================

export interface WeeklyAchievementRecord {
	year: number;
	week: number;
}

export interface StreakResult {
	currentStreak: number;
	bestStreak: number;
}
