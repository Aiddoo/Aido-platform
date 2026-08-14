import type {
	CategoryBreakdownItem,
	DayPatternItem,
	TimePatternItem,
} from "@aido/validators";
import type { SupportedLocale } from "@/shared/domain/locale";

/**
 * 리포트 타입 — Prisma ReportType과 동일한 리터럴(도메인은 generated를 참조하지 않는다)
 */
export type ReportType = "WEEKLY" | "MONTHLY";

/**
 * 집계된 리포트 데이터
 */
export interface AggregatedReportData {
	totalTodos: number;
	completedTodos: number;
	completionRate: number;
	prevCompletionRate: number | null;
	streakDays: number;
	categoryBreakdown: CategoryBreakdownItem[];
	dayPatterns: DayPatternItem[];
	timePatterns: TimePatternItem[];
	hasActivity: boolean;
}

/**
 * 데이터 집계 파라미터
 */
export interface AggregateParams {
	userId: string;
	startDate: Date;
	endDate: Date;
	prevStartDate: Date;
	prevEndDate: Date;
	timezone: string;
}

/**
 * AI 리포트 생성 파라미터
 */
export interface GenerateReportParams {
	/** 생성 언어 (기본 ko — 기존 유저 하위 호환) */
	locale?: SupportedLocale;
	aggregatedData: AggregatedReportData;
	type: ReportType;
	periodLabel: string;
	prevTips: string[] | null;
}

/**
 * AI가 생성한 리포트 콘텐츠
 */
export interface GeneratedReportContent {
	aiSummary: string;
	aiTips: string[];
}

/** 날짜별 그룹 집계 행 (todo.groupBy by startDate) */
export interface DailyGroupRow {
	startDate: Date;
	_count: { id: number };
}

/** 카테고리별 그룹 집계 행 (todo.groupBy by categoryId) */
export interface CategoryGroupRow {
	categoryId: number;
	_count: { id: number };
}

/** 카테고리 메타 행 */
export interface CategoryMetaRow {
	id: number;
	name: string;
	color: string;
}

/** 완료 시각 분석용 행 */
export interface CompletedTodoRow {
	startDate: Date;
	completedAt: Date | null;
}

/**
 * 집계 입력 원시 데이터 — 저장소(reader)가 조회하고 도메인이 계산한다.
 */
export interface AggregationInputs {
	dailyTotalGroups: DailyGroupRow[];
	dailyCompletedGroups: DailyGroupRow[];
	prevTotalCount: number;
	prevCompletedCount: number;
	catTotalGroups: CategoryGroupRow[];
	catCompletedGroups: CategoryGroupRow[];
	categories: CategoryMetaRow[];
	completedTodos: CompletedTodoRow[];
}
