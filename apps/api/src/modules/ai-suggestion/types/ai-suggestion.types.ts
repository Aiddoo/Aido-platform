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
}
