import type * as Validators from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";
import type { SupportedLocale } from "@/shared/presentation/decorators";
import type { ReportType } from "../../domain/types";
import {
	AI_REPORT_REPOSITORY,
	type AiReportRepositoryPort,
} from "../ports/ai-report.repository.port";
import { GenerateReportUseCase } from "../use-cases/generate-report/generate-report.use-case";
import { GetReportByIdUseCase } from "../use-cases/get-report-by-id/get-report-by-id.use-case";
import { GetReportStatusUseCase } from "../use-cases/get-report-status/get-report-status.use-case";
import { GetReportsUseCase } from "../use-cases/get-reports/get-reports.use-case";

/**
 * AI 리포트 Facade.
 *
 * 컨트롤러·프로세서·크로스모듈의 유일한 주입 대상. 조회/생성 use-case로 위임한다.
 */
@Injectable()
export class AiReportFacade {
	constructor(
		private readonly getReportStatusUseCase: GetReportStatusUseCase,
		private readonly getReportsUseCase: GetReportsUseCase,
		private readonly getReportByIdUseCase: GetReportByIdUseCase,
		private readonly generateReportUseCase: GenerateReportUseCase,
		@Inject(AI_REPORT_REPOSITORY)
		private readonly aiReportRepository: AiReportRepositoryPort,
	) {}

	getReportStatus(
		userId: string,
		timezone: string,
	): Promise<Validators.ReportStatus> {
		return this.getReportStatusUseCase.execute(userId, timezone);
	}

	getReports(
		userId: string,
		params: { type?: ReportType; limit: number },
	): Promise<Validators.AiReport[]> {
		return this.getReportsUseCase.execute(userId, params);
	}

	getReportById(userId: string, id: number): Promise<Validators.AiReport> {
		return this.getReportByIdUseCase.execute(userId, id);
	}

	generateWeeklyReport(
		userId: string,
		timezone: string,
		locale: SupportedLocale = "ko",
	): Promise<Validators.AiReport | null> {
		return this.generateReportUseCase.execute({
			userId,
			timezone,
			type: "WEEKLY",
			locale,
		});
	}

	generateMonthlyReport(
		userId: string,
		timezone: string,
		locale: SupportedLocale = "ko",
	): Promise<Validators.AiReport | null> {
		return this.generateReportUseCase.execute({
			userId,
			timezone,
			type: "MONTHLY",
			locale,
		});
	}

	/**
	 * 최신 리포트 통계 조회 (크로스모듈 — ai-suggestion 컨텍스트 주입용).
	 */
	async findLatestReportStats(
		userId: string,
		type: ReportType,
	): Promise<Validators.ReportStats | null> {
		const report = await this.aiReportRepository.findLatest(userId, type);
		return report ? report.stats : null;
	}
}
