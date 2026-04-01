import type {
	CategoryBreakdownItem,
	DayPatternItem,
	TimePatternItem,
} from "@aido/validators";
import type { AiReport, ReportType } from "@/generated/prisma/client";

/**
 * 리포트 조회 파라미터
 */
export interface FindReportsParams {
	userId: string;
	type?: ReportType;
	limit: number;
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
 * AI 리포트 생성 파라미터
 */
export interface GenerateReportParams {
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

/**
 * Prisma AiReport 엔티티 타입 (JSON 필드 타입 지정)
 */
export type AiReportEntity = AiReport;
