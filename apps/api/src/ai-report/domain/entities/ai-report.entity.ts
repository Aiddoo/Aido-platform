import type * as Validators from "@aido/validators";

import type { SupportedLocale } from "@/shared/domain/locale";

import { computeDateRange, computePeriodLabel } from "../services/report-period";
import type { ReportType } from "../types";

export interface AiReportProps {
	id: number;
	userId: string;
	type: ReportType;
	year: number;
	period: number;
	stats: Validators.ReportStats;
	categoryBreakdown: Validators.CategoryBreakdownItem[];
	dayPatterns: Validators.DayPatternItem[];
	timePatterns: Validators.TimePatternItem[];
	aiSummary: string;
	aiTips: string[];
	locale: SupportedLocale;
	hasActivity: boolean;
	generatedAt: Date;
}

/**
 * AI 리포트 애그리게잇.
 *
 * 주간/월간 분석 리포트를 표현하며, 응답 뷰 직렬화(기간 라벨·날짜 범위 파생 포함)를
 * 자기 자신이 소유한다. Json 파싱(무결성 복원)은 저장소 어댑터가 담당하고, 이 애그리게잇은
 * 이미 파싱된 타입 안전 필드를 보유한다.
 */
export class AiReport {
	private constructor(private readonly props: AiReportProps) {}

	static reconstitute(props: AiReportProps): AiReport {
		return new AiReport(props);
	}

	get id(): number {
		return this.props.id;
	}

	get type(): ReportType {
		return this.props.type;
	}

	get stats(): Validators.ReportStats {
		return this.props.stats;
	}

	get aiTips(): string[] {
		return this.props.aiTips;
	}

	/** 응답 DTO로 직렬화 (기간 라벨·날짜 범위는 파생 계산) */
	toView(): Validators.AiReport {
		const { type, year, period, locale } = this.props;
		return {
			id: this.props.id,
			type,
			year,
			period,
			periodLabel: computePeriodLabel(type, year, period, locale),
			dateRange: computeDateRange(type, year, period),
			stats: this.props.stats,
			categoryBreakdown: this.props.categoryBreakdown,
			dayPatterns: this.props.dayPatterns,
			timePatterns: this.props.timePatterns,
			aiSummary: this.props.aiSummary,
			aiTips: this.props.aiTips,
			hasActivity: this.props.hasActivity,
			generatedAt: this.props.generatedAt.toISOString(),
		};
	}
}
