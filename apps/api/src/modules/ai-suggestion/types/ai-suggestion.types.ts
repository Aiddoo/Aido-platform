import type { DayOfWeek } from "@aido/validators";

/**
 * AI가 감지한 반복 패턴
 */
export interface DetectedPattern {
	title: string;
	daysOfWeek: DayOfWeek[];
	scheduledTime: string | null;
	confidence: number;
	reason: string;
	matchedTitles: string[];
}

/**
 * 패턴 분석에 사용할 Todo 요약 정보
 */
export interface TodoSummaryForAnalysis {
	title: string;
	startDate: string;
	scheduledTime: string | null;
	categoryId: number;
	completed: boolean;
	categoryName: string;
}

/**
 * 요일별 완료율
 */
export interface DayCompletionRate {
	day: string;
	total: number;
	completed: number;
}

/**
 * 시간대별 완료율
 */
export interface TimeCompletionRate {
	morning: { count: number; rate: number };
	afternoon: { count: number; rate: number };
}

/**
 * 카테고리별 완료율
 */
export interface CategoryCompletionRate {
	name: string;
	total: number;
	completed: number;
	rate: number;
}

/**
 * 사용자 스트릭 정보
 */
export interface UserStreakInfo {
	currentStreak: number;
	longestStreak: number;
}

/**
 * AI 제안 생성을 위한 사전 계산된 컨텍스트
 */
export interface SuggestionContext {
	todos: TodoSummaryForAnalysis[];
	dayCompletionRates: string;
	timeCompletionRates: string;
	categoryRates: string;
	streak: string;
	missingRoutines: string[];
	weather: string | null;
	currentDate: string;
}
