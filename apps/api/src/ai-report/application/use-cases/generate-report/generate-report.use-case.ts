import type { AiReport as AiReportDto } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import dayjs from "dayjs";
import { now } from "@/shared/domain/date/utils/core";
import type { SupportedLocale } from "@/shared/presentation/decorators";
import { computePeriodLabel } from "../../../domain/services/report-period";
import type { ReportType } from "../../../domain/types";
import {
	AI_REPORT_REPOSITORY,
	type AiReportRepositoryPort,
} from "../../ports/ai-report.repository.port";
import { ReportAggregatorService } from "../../services/report-aggregator.service";
import { ReportGeneratorService } from "../../services/report-generator.service";

/** 기간 윈도우 계산 결과 */
interface ReportWindow {
	year: number;
	period: number;
	startDate: Date;
	endDate: Date;
	prevStartDate: Date;
	prevEndDate: Date;
}

/**
 * AI 리포트 생성 use-case.
 *
 * 주간/월간 데이터를 집계하고 AI 분석을 수행하여 리포트를 저장한다.
 * 같은 기간 리포트가 이미 존재하면 생성하지 않고 null을 반환한다.
 */
@Injectable()
export class GenerateReportUseCase {
	readonly #logger = new Logger(GenerateReportUseCase.name);

	constructor(
		@Inject(AI_REPORT_REPOSITORY)
		private readonly aiReportRepository: AiReportRepositoryPort,
		private readonly reportAggregatorService: ReportAggregatorService,
		private readonly reportGeneratorService: ReportGeneratorService,
	) {}

	async execute(input: {
		userId: string;
		timezone: string;
		type: ReportType;
		locale?: SupportedLocale;
	}): Promise<AiReportDto | null> {
		const { userId, timezone, type, locale = "ko" } = input;
		const localNow = dayjs(now()).tz(timezone);

		const window =
			type === "WEEKLY"
				? this.#weeklyWindow(localNow)
				: this.#monthlyWindow(localNow);

		const exists = await this.aiReportRepository.exists(
			userId,
			type,
			window.year,
			window.period,
		);
		if (exists) {
			this.#logger.debug(
				`${type === "WEEKLY" ? "주간" : "월간"} 리포트 이미 존재: userId=${userId}, ${window.year}년 ${window.period}${type === "WEEKLY" ? "주차" : "월"}`,
			);
			return null;
		}

		return this.#generateReport({
			userId,
			timezone,
			type,
			year: window.year,
			period: window.period,
			startDate: window.startDate,
			endDate: window.endDate,
			prevStartDate: window.prevStartDate,
			prevEndDate: window.prevEndDate,
			periodLabel: computePeriodLabel(type, window.year, window.period, locale),
			locale,
		});
	}

	/** 지난 주(월~일) 윈도우 */
	#weeklyWindow(localNow: dayjs.Dayjs): ReportWindow {
		const lastWeekStart = localNow.subtract(1, "week").startOf("isoWeek");
		const lastWeekEnd = lastWeekStart.add(1, "week");
		const prevWeekStart = lastWeekStart.subtract(1, "week");
		const prevWeekEnd = lastWeekStart;
		return {
			year: lastWeekStart.isoWeekYear(),
			period: lastWeekStart.isoWeek(),
			startDate: lastWeekStart.utc().toDate(),
			endDate: lastWeekEnd.utc().toDate(),
			prevStartDate: prevWeekStart.utc().toDate(),
			prevEndDate: prevWeekEnd.utc().toDate(),
		};
	}

	/** 지난 달 윈도우 */
	#monthlyWindow(localNow: dayjs.Dayjs): ReportWindow {
		const lastMonth = localNow.subtract(1, "month");
		const lastMonthStart = lastMonth.startOf("month");
		const lastMonthEnd = lastMonth.endOf("month").add(1, "day").startOf("day");
		const prevMonthStart = lastMonthStart.subtract(1, "month");
		const prevMonthEnd = lastMonthStart;
		return {
			year: lastMonthStart.year(),
			period: lastMonthStart.month() + 1,
			startDate: lastMonthStart.utc().toDate(),
			endDate: lastMonthEnd.utc().toDate(),
			prevStartDate: prevMonthStart.utc().toDate(),
			prevEndDate: prevMonthEnd.utc().toDate(),
		};
	}

	/**
	 * 리포트 생성 오케스트레이션
	 */
	async #generateReport(params: {
		userId: string;
		timezone: string;
		locale: SupportedLocale;
		type: ReportType;
		year: number;
		period: number;
		startDate: Date;
		endDate: Date;
		prevStartDate: Date;
		prevEndDate: Date;
		periodLabel: string;
	}): Promise<AiReportDto> {
		const {
			userId,
			timezone,
			type,
			year,
			period,
			startDate,
			endDate,
			prevStartDate,
			prevEndDate,
			periodLabel,
			locale,
		} = params;

		this.#logger.log(
			`리포트 생성 시작: userId=${userId}, type=${type}, ${periodLabel}`,
		);

		// 1. 데이터 집계 + 이전 보고서 조회 (병렬)
		const [aggregatedData, prevReport] = await Promise.all([
			this.reportAggregatorService.aggregate({
				userId,
				startDate,
				endDate,
				prevStartDate,
				prevEndDate,
				timezone,
			}),
			this.aiReportRepository.findLatest(userId, type),
		]);

		const prevTips = prevReport ? prevReport.aiTips : null;

		// 2. AI 콘텐츠 생성
		const aiContent = await this.reportGeneratorService.generate({
			aggregatedData,
			type,
			periodLabel,
			prevTips,
			locale,
		});

		// 3. DB 저장
		const report = await this.aiReportRepository.create({
			userId,
			type,
			year,
			period,
			stats: {
				totalTodos: aggregatedData.totalTodos,
				completedTodos: aggregatedData.completedTodos,
				completionRate: aggregatedData.completionRate,
				prevCompletionRate: aggregatedData.prevCompletionRate,
				streakDays: aggregatedData.streakDays,
			},
			categoryBreakdown: aggregatedData.categoryBreakdown,
			dayPatterns: aggregatedData.dayPatterns,
			timePatterns: aggregatedData.timePatterns,
			aiSummary: aiContent.aiSummary,
			aiTips: aiContent.aiTips,
			locale,
			hasActivity: aggregatedData.hasActivity,
			generatedAt: now(),
		});

		this.#logger.log(
			`리포트 생성 완료: id=${report.id}, userId=${userId}, type=${type}, ${periodLabel}`,
		);

		return report.toView();
	}
}
