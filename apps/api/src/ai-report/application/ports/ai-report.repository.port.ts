import type {
	CategoryBreakdownItem,
	DayPatternItem,
	ReportStats,
	TimePatternItem,
} from "@aido/validators";
import type { SupportedLocale } from "@/shared/domain/locale";

import type { AiReport } from "../../domain/entities/ai-report.entity";
import type { ReportType } from "../../domain/types";

export const AI_REPORT_REPOSITORY = Symbol("AI_REPORT_REPOSITORY");

/** 리포트 조회 파라미터 */
export interface FindReportsParams {
	userId: string;
	type?: ReportType;
	limit: number;
}

/** 리포트 생성 입력 — Json 직렬화는 어댑터 경계가 담당한다 */
export interface CreateAiReportInput {
	userId: string;
	type: ReportType;
	year: number;
	period: number;
	stats: ReportStats;
	categoryBreakdown: CategoryBreakdownItem[];
	dayPatterns: DayPatternItem[];
	timePatterns: TimePatternItem[];
	aiSummary: string;
	aiTips: string[];
	locale: SupportedLocale;
	hasActivity: boolean;
	generatedAt: Date;
}

/**
 * AI 리포트 저장소 포트.
 *
 * 트랜잭션은 CLS로 전파된다. Prisma Json 필드의 직렬화/역직렬화는 어댑터가 소유한다.
 */
export interface AiReportRepositoryPort {
	create(input: CreateAiReportInput): Promise<AiReport>;
	findByIdAndUserId(id: number, userId: string): Promise<AiReport | null>;
	findLatest(userId: string, type: ReportType): Promise<AiReport | null>;
	findMany(params: FindReportsParams): Promise<AiReport[]>;
	exists(
		userId: string,
		type: ReportType,
		year: number,
		period: number,
	): Promise<boolean>;
}
