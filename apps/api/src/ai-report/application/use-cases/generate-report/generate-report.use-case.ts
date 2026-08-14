import type { AiReport as AiReportDto } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import dayjs from "dayjs";

import { AI_PROVIDER, type AiProvider } from "@/ai";
import { now } from "@/shared/domain/date/utils/core";
import type { SupportedLocale } from "@/shared/domain/locale";

import { buildFallbackContent } from "../../../domain/services/prompts/report-fallback";
import {
	buildReportPrompt,
	getReportAiResponseSchema,
} from "../../../domain/services/prompts/report.prompt";
import { assembleAggregatedData } from "../../../domain/services/report-aggregation";
import { computePeriodLabel } from "../../../domain/services/report-period";
import type {
	AggregatedReportData,
	AggregateParams,
	GeneratedReportContent,
	GenerateReportParams,
	ReportType,
} from "../../../domain/types";
import {
	AI_REPORT_REPOSITORY,
	type AiReportRepositoryPort,
} from "../../ports/ai-report.repository.port";
import { TODO_STATS_READER, type TodoStatsReaderPort } from "../../ports/todo-stats.reader.port";

/** AI 리포트 생성 기본 설정 */
const REPORT_AI_MAX_TOKENS = 800;

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
		@Inject(TODO_STATS_READER)
		private readonly todoStatsReader: TodoStatsReaderPort,
		@Inject(AI_PROVIDER)
		private readonly aiProvider: AiProvider,
	) {}

	async execute(input: {
		userId: string;
		timezone: string;
		type: ReportType;
		locale?: SupportedLocale;
	}): Promise<AiReportDto | null> {
		const { userId, timezone, type, locale = "ko" } = input;
		const localNow = dayjs(now()).tz(timezone);

		const window = type === "WEEKLY" ? this.#weeklyWindow(localNow) : this.#monthlyWindow(localNow);

		const exists = await this.aiReportRepository.exists(userId, type, window.year, window.period);
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
		// 지난 달 시작에 1달을 더하면 이번 달 시작(00:00) = 지난 달 배타적 종료.
		// (endOf/add/startOf 다단계 계산과 동일하나 타임존·DST 경계 오류를 예방)
		const lastMonthEnd = lastMonthStart.add(1, "month");
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

		this.#logger.log(`리포트 생성 시작: userId=${userId}, type=${type}, ${periodLabel}`);

		// 1. 데이터 집계 + 이전 보고서 조회 (병렬)
		const [aggregatedData, prevReport] = await Promise.all([
			this.#aggregate({
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
		const aiContent = await this.#generateAiContent({
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

	/**
	 * 데이터 집계: 할 일 통계 읽기 포트로 원시 집계를 조회하고 도메인 서비스로 계산.
	 */
	async #aggregate(params: AggregateParams): Promise<AggregatedReportData> {
		const inputs = await this.todoStatsReader.fetchAggregationInputs(params);
		return assembleAggregatedData(inputs, params.startDate, params.endDate, params.timezone);
	}

	/**
	 * AI 콘텐츠 생성: AI Provider로 요약·팁 생성. 불가용/실패 시 폴백.
	 * 시스템 호출이므로 사용량 제한에 포함되지 않는다(AI_PROVIDER 직접 사용).
	 */
	async #generateAiContent(params: GenerateReportParams): Promise<GeneratedReportContent> {
		const { aggregatedData, periodLabel, type, locale = "ko" } = params;

		if (!this.aiProvider.isAvailable()) {
			this.#logger.warn("AI Provider 불가용 — 폴백 콘텐츠 사용");
			return buildFallbackContent(aggregatedData.hasActivity, locale);
		}

		try {
			const { system, prompt } = buildReportPrompt(
				aggregatedData,
				periodLabel,
				type,
				{ prevTips: params.prevTips },
				locale,
			);

			const result = await this.aiProvider.generateStructured({
				system,
				prompt,
				schema: getReportAiResponseSchema(locale),
				maxOutputTokens: REPORT_AI_MAX_TOKENS,
			});

			this.#logger.debug(
				`AI 리포트 생성 완료: model=${result.model}, tokens=${result.usage.input}+${result.usage.output}`,
			);

			return {
				aiSummary: result.output.summary,
				aiTips: result.output.tips,
			};
		} catch (error) {
			this.#logger.error(
				`AI 리포트 생성 실패 — 폴백 사용: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
			return buildFallbackContent(aggregatedData.hasActivity, locale);
		}
	}
}
