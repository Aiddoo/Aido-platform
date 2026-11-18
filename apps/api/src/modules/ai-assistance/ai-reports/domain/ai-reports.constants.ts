import type { AI_REPORT_TYPES, DayOfWeek, Localized } from "@aido/api/vocabulary";

/** 코치 카드(393pt 폭·13pt) 글자 수: ko 두 줄, en tip 두 줄·insight 세 줄. 넘는 문장은 자르지 않고 버린다 */
export const REPORT_TEXT_MAX_LENGTH = {
  ko: { insight: 70, tip: 55 },
  en: { insight: 120, tip: 90 },
} as const satisfies Localized<{ insight: number; tip: number }>;
export const REPORT_MAX_TIPS = 2;

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
export interface DailyCompletionItem {
  readonly date: Temporal.PlainDate;
  readonly total: number;
  readonly completed: number;
}

/** 리포트 타입. DB ReportType enum과 같은 vocabulary 튜플에서 유도한다 */
export type ReportType = (typeof AI_REPORT_TYPES)[number];

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

/** 프롬프트에 넣지 않고 리포트에만 저장하는 날마다 기록까지 담은 집계 */
export interface ReportAggregation extends AggregatedReportData {
  readonly dailyCompletions: DailyCompletionItem[];
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
/**
 * 저장된 요약·팁의 출처. AI 실패로 저장한 폴백, 활동 없음 템플릿, 사용자가 AI 데이터 처리를
 * 거부해 AI 없이 만든 요약을 구분해 재생성·분석에 쓴다.
 */
export const REPORT_CONTENT_SOURCES = ["AI", "FALLBACK", "TEMPLATE", "NO_AI_CONSENT"] as const;

export type ReportContentSource = (typeof REPORT_CONTENT_SOURCES)[number];

/**
 * AI가 생성한 리포트 콘텐츠
 */
export interface GeneratedReportContent {
  readonly aiSummary: string;
  readonly aiTips: string[];
}

/** 저장할 리포트 콘텐츠와 출처 */
export interface ReportContent extends GeneratedReportContent {
  readonly contentSource: ReportContentSource;
  readonly promptVersion: string | null;
}

/** 날짜별 할 일 수 */
export interface DailyTodoGroup {
  readonly startDate: Date;
  readonly _count: { readonly id: number };
}

/** 카테고리별 할 일 수 */
export interface CategoryTodoGroup {
  readonly categoryId: number;
  readonly _count: { readonly id: number };
}

/** 리포트에 이름·색을 싣는 카테고리 */
export interface ReportCategory {
  readonly id: number;
  readonly name: string;
  readonly color: string;
}

/** 완료 시각 분석에 쓰는 할 일의 날짜와 완료 시각 */
export interface CompletedTodoTime {
  readonly startDate: Date;
  readonly completedAt: Date | null;
}

/**
 * 집계 입력 원시 데이터 — 저장소(reader)가 조회하고 도메인이 계산한다.
 */
export interface AggregationInputs {
  readonly dailyTotalGroups: DailyTodoGroup[];
  readonly dailyCompletedGroups: DailyTodoGroup[];
  readonly prevTotalCount: number;
  readonly prevCompletedCount: number;
  readonly catTotalGroups: CategoryTodoGroup[];
  readonly catCompletedGroups: CategoryTodoGroup[];
  readonly categories: ReportCategory[];
  readonly completedTodos: CompletedTodoTime[];
}
