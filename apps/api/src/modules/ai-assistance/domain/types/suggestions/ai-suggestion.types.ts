import type { DayOfWeek } from "@aido/api/vocabulary";

/**
 * AI가 감지한 반복 패턴
 */
export interface DetectedPattern {
  readonly title: string;
  readonly daysOfWeek: DayOfWeek[];
  readonly scheduledTime: string | null;
  readonly confidence: number;
  readonly reason: string;
  readonly matchedTitles: string[];
}

/**
 * 패턴 분석에 사용할 Todo 요약 정보
 */
export interface TodoSummaryForAnalysis {
  readonly title: string;
  readonly startDate: string;
  readonly scheduledTime: string | null;
  readonly categoryId: number;
  readonly completed: boolean;
  readonly categoryName: string;
}

/**
 * 요일별 완료율
 */
export interface DayCompletionRate {
  readonly day: DayOfWeek;
  readonly total: number;
  readonly completed: number;
}

/**
 * 시간대별 완료율
 */
export interface TimeCompletionRate {
  readonly morning: { count: number; rate: number };
  readonly afternoon: { count: number; rate: number };
}

/**
 * 카테고리별 완료율
 */
export interface CategoryCompletionRate {
  readonly name: string;
  readonly total: number;
  readonly completed: number;
  readonly rate: number;
}

/**
 * 사용자 스트릭 정보
 */
export interface UserStreakInfo {
  readonly currentStreak: number;
  readonly longestStreak: number;
}

/**
 * 제안 수락/거절 이력 항목
 */
export interface SuggestionHistoryItem {
  readonly title: string;
  readonly status: "ACCEPTED" | "DISMISSED";
}

/** 저장 후보를 검증할 실제 사용자 기록과 날씨 근거. */
export interface PatternEvidenceContext {
  readonly todos: readonly TodoSummaryForAnalysis[];
  readonly weather: string | null;
}

/** Calendar DATE 기준 실제 기록과 완료 근거. 등록 횟수와 완료 횟수는 구분한다. */
export interface RecordedActivityEvidence {
  readonly title: string;
  readonly occurrences: number;
  readonly completedOccurrences: number;
  readonly days: readonly {
    readonly day: DayOfWeek;
    readonly total: number;
    readonly completed: number;
  }[];
  readonly recordedTimes: readonly string[];
}
