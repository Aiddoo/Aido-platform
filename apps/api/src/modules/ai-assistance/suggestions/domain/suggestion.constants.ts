import type { DayOfWeek, SuggestionActionKind } from "@aido/api/vocabulary";

import type { SuggestionStatus } from "./suggestion.aggregate.js";

export type SuggestionAction = SuggestionActionKind;

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
 * 제안 수락/거절 이력 항목
 */
export interface SuggestionHistoryItem {
  readonly title: string;
  readonly status: Exclude<SuggestionStatus, "PENDING">;
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
