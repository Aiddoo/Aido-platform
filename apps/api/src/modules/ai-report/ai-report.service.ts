import type { AiReport as AiReportDto, ReportStatus } from "@aido/validators";
import { Injectable, Logger } from "@nestjs/common";
import dayjs from "dayjs";
import { now } from "@/common/date/utils/core";
import { EntitlementService } from "@/common/entitlement/entitlement.service";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import type { Prisma, ReportType } from "@/generated/prisma/client";

import { AiReportMapper } from "./ai-report.mapper";
import { AiReportRepository } from "./ai-report.repository";
import { ReportAggregatorService } from "./report-aggregator.service";
import { ReportGeneratorService } from "./report-generator.service";
import type { FindReportsParams } from "./types";

/**
 * AI 리포트 서비스
 *
 * 리포트 상태 조회, 목록 조회, 상세 조회 및 리포트 생성 오케스트레이션을 담당합니다.
 */
@Injectable()
export class AiReportService {
	readonly #logger = new Logger(AiReportService.name);

	constructor(
		private readonly aiReportRepository: AiReportRepository,
		private readonly reportAggregatorService: ReportAggregatorService,
		private readonly reportGeneratorService: ReportGeneratorService,
		private readonly entitlementService: EntitlementService,
	) {}

	/**
	 * 리포트 상태 조회
	 *
	 * 다음 주간/월간 리포트 예정일과 최신 리포트를 반환합니다.
	 */
	async getReportStatus(
		userId: string,
		timezone: string,
	): Promise<ReportStatus> {
		await this.#enforcePremium(userId);
		const currentTime = now();
		const localNow = dayjs(currentTime).tz(timezone);

		const nextMonday = localNow.startOf("isoWeek").add(1, "week");
		const daysUntilWeekly = nextMonday.diff(localNow, "day");

		const nextMonth = localNow.add(1, "month").startOf("month");
		const daysUntilMonthly = nextMonth.diff(localNow, "day");

		const [latestWeekly, latestMonthly] = await Promise.all([
			this.aiReportRepository.findLatest(userId, "WEEKLY"),
			this.aiReportRepository.findLatest(userId, "MONTHLY"),
		]);

		return {
			nextWeeklyAt: nextMonday.utc().toISOString(),
			nextMonthlyAt: nextMonth.utc().toISOString(),
			daysUntilWeekly,
			daysUntilMonthly,
			latestWeekly: latestWeekly
				? AiReportMapper.toResponse(latestWeekly)
				: null,
			latestMonthly: latestMonthly
				? AiReportMapper.toResponse(latestMonthly)
				: null,
		};
	}

	/**
	 * 리포트 목록 조회
	 */
	async getReports(
		userId: string,
		params: { type?: ReportType; limit: number },
	): Promise<AiReportDto[]> {
		await this.#enforcePremium(userId);
		const findParams: FindReportsParams = {
			userId,
			type: params.type,
			limit: params.limit,
		};

		const reports = await this.aiReportRepository.findMany(findParams);
		return AiReportMapper.toManyResponse(reports);
	}

	/**
	 * 리포트 상세 조회
	 */
	async getReportById(userId: string, id: number): Promise<AiReportDto> {
		await this.#enforcePremium(userId);
		const report = await this.aiReportRepository.findByIdAndUserId(id, userId);

		if (!report) {
			throw BusinessExceptions.aiReportNotFound(id);
		}

		return AiReportMapper.toResponse(report);
	}

	/**
	 * 주간 리포트 생성
	 *
	 * 지난 주 (월~일) 데이터를 집계하고 AI 분석을 수행합니다.
	 */
	async generateWeeklyReport(
		userId: string,
		timezone: string,
	): Promise<AiReportDto | null> {
		const localNow = dayjs(now()).tz(timezone);

		const lastWeekStart = localNow.subtract(1, "week").startOf("isoWeek");
		const lastWeekEnd = lastWeekStart.add(1, "week");
		const year = lastWeekStart.isoWeekYear();
		const period = lastWeekStart.isoWeek();

		const exists = await this.aiReportRepository.exists(
			userId,
			"WEEKLY",
			year,
			period,
		);
		if (exists) {
			this.#logger.debug(
				`주간 리포트 이미 존재: userId=${userId}, ${year}년 ${period}주차`,
			);
			return null;
		}

		const prevWeekStart = lastWeekStart.subtract(1, "week");
		const prevWeekEnd = lastWeekStart;

		return this.#generateReport({
			userId,
			timezone,
			type: "WEEKLY",
			year,
			period,
			startDate: lastWeekStart.utc().toDate(),
			endDate: lastWeekEnd.utc().toDate(),
			prevStartDate: prevWeekStart.utc().toDate(),
			prevEndDate: prevWeekEnd.utc().toDate(),
			periodLabel: AiReportMapper.computePeriodLabel("WEEKLY", year, period),
		});
	}

	/**
	 * 월간 리포트 생성
	 *
	 * 지난 달 데이터를 집계하고 AI 분석을 수행합니다.
	 */
	async generateMonthlyReport(
		userId: string,
		timezone: string,
	): Promise<AiReportDto | null> {
		const localNow = dayjs(now()).tz(timezone);

		const lastMonth = localNow.subtract(1, "month");
		const lastMonthStart = lastMonth.startOf("month");
		const lastMonthEnd = lastMonth.endOf("month").add(1, "day").startOf("day");
		const year = lastMonthStart.year();
		const period = lastMonthStart.month() + 1;

		const exists = await this.aiReportRepository.exists(
			userId,
			"MONTHLY",
			year,
			period,
		);
		if (exists) {
			this.#logger.debug(
				`월간 리포트 이미 존재: userId=${userId}, ${year}년 ${period}월`,
			);
			return null;
		}

		const prevMonthStart = lastMonthStart.subtract(1, "month");
		const prevMonthEnd = lastMonthStart;

		return this.#generateReport({
			userId,
			timezone,
			type: "MONTHLY",
			year,
			period,
			startDate: lastMonthStart.utc().toDate(),
			endDate: lastMonthEnd.utc().toDate(),
			prevStartDate: prevMonthStart.utc().toDate(),
			prevEndDate: prevMonthEnd.utc().toDate(),
			periodLabel: AiReportMapper.computePeriodLabel("MONTHLY", year, period),
		});
	}

	async #enforcePremium(userId: string): Promise<void> {
		const hasPremium = await this.entitlementService.hasPremiumAccess(userId);
		if (!hasPremium) {
			throw BusinessExceptions.aiReportPremiumRequired();
		}
	}

	/**
	 * 리포트 생성 오케스트레이션
	 */
	async #generateReport(params: {
		userId: string;
		timezone: string;
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
		} = params;

		this.#logger.log(
			`리포트 생성 시작: userId=${userId}, type=${type}, ${periodLabel}`,
		);

		// 1. 데이터 집계
		const aggregatedData = await this.reportAggregatorService.aggregate({
			userId,
			startDate,
			endDate,
			prevStartDate,
			prevEndDate,
			timezone,
		});

		// 2. AI 콘텐츠 생성
		const aiContent = await this.reportGeneratorService.generate({
			aggregatedData,
			type,
			periodLabel,
		});

		// 3. DB 저장
		const report = await this.aiReportRepository.create({
			user: { connect: { id: userId } },
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
			categoryBreakdown:
				aggregatedData.categoryBreakdown as unknown as Prisma.InputJsonValue,
			dayPatterns:
				aggregatedData.dayPatterns as unknown as Prisma.InputJsonValue,
			timePatterns:
				aggregatedData.timePatterns as unknown as Prisma.InputJsonValue,
			aiSummary: aiContent.aiSummary,
			aiTips: aiContent.aiTips as unknown as Prisma.InputJsonValue,
			hasActivity: aggregatedData.hasActivity,
			generatedAt: now(),
		});

		this.#logger.log(
			`리포트 생성 완료: id=${report.id}, userId=${userId}, type=${type}, ${periodLabel}`,
		);

		return AiReportMapper.toResponse(report);
	}
}
