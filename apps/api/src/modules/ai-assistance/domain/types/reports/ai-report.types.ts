import type { DayOfWeek } from "@aido/api/vocabulary";

import type { SupportedLocale } from "#api/shared/domain/locale";

export interface ReportStats {
  readonly totalTodos: number;
  readonly completedTodos: number;
  readonly completionRate: number;
  readonly prevCompletionRate: number | null;
  readonly streakDays: number;
}
export interface CategoryBreakdownItem {
  readonly name: string;
  readonly color: string;
  readonly total: number;
  readonly completed: number;
  readonly rate: number;
}
export interface DayPatternItem {
  readonly day: DayOfWeek;
  readonly total: number;
  readonly completed: number;
  readonly rate: number;
}
export interface TimePatternItem {
  readonly hour: number;
  readonly count: number;
}

/**
 * 리포트 타입 — Prisma ReportType과 동일한 리터럴(도메인은 generated를 참조하지 않는다)
 */
export type ReportType = "WEEKLY" | "MONTHLY";

/**
 * 집계된 리포트 데이터
 */
export interface AggregatedReportData {
  readonly totalTodos: number;
  readonly completedTodos: number;
  readonly completionRate: number;
  readonly prevCompletionRate: number | null;
  readonly streakDays: number;
  readonly categoryBreakdown: CategoryBreakdownItem[];
  readonly dayPatterns: DayPatternItem[];
  readonly timePatterns: TimePatternItem[];
  readonly hasActivity: boolean;
}

/**
 * 데이터 집계 파라미터
 */
export interface AggregateParams {
  readonly userId: string;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly prevStartDate: Date;
  readonly prevEndDate: Date;
  readonly timezone: string;
}

/**
 * AI 리포트 생성 파라미터
 */
export interface GenerateReportParams {
  /** 생성 언어 (기본 ko — 기존 유저 하위 호환) */
  readonly locale?: SupportedLocale;
  readonly aggregatedData: AggregatedReportData;
  readonly type: ReportType;
  readonly periodLabel: string;
  readonly prevTips: string[] | null;
}

/**
 * AI가 생성한 리포트 콘텐츠
 */
export interface GeneratedReportContent {
  readonly aiSummary: string;
  readonly aiTips: string[];
}

/** 날짜별 그룹 집계 행 (todo.groupBy by startDate) */
export interface DailyGroupRow {
  readonly startDate: Date;
  readonly _count: { readonly id: number };
}

/** 카테고리별 그룹 집계 행 (todo.groupBy by categoryId) */
export interface CategoryGroupRow {
  readonly categoryId: number;
  readonly _count: { readonly id: number };
}

/** 카테고리 메타 행 */
export interface CategoryMetaRow {
  readonly id: number;
  readonly name: string;
  readonly color: string;
}

/** 완료 시각 분석용 행 */
export interface CompletedTodoRow {
  readonly startDate: Date;
  readonly completedAt: Date | null;
}

/**
 * 집계 입력 원시 데이터 — 저장소(reader)가 조회하고 도메인이 계산한다.
 */
export interface AggregationInputs {
  readonly dailyTotalGroups: DailyGroupRow[];
  readonly dailyCompletedGroups: DailyGroupRow[];
  readonly prevTotalCount: number;
  readonly prevCompletedCount: number;
  readonly catTotalGroups: CategoryGroupRow[];
  readonly catCompletedGroups: CategoryGroupRow[];
  readonly categories: CategoryMetaRow[];
  readonly completedTodos: CompletedTodoRow[];
}
