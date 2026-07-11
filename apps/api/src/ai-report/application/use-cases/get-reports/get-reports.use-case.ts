import type { AiReport as AiReportDto } from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";

import type { ReportType } from "../../../domain/types";
import {
	AI_REPORT_REPOSITORY,
	type AiReportRepositoryPort,
} from "../../ports/ai-report.repository.port";
import { ReportAccessService } from "../../services/report-access.service";

/**
 * 리포트 목록 조회 use-case.
 */
@Injectable()
export class GetReportsUseCase {
	constructor(
		@Inject(AI_REPORT_REPOSITORY)
		private readonly aiReportRepository: AiReportRepositoryPort,
		private readonly reportAccess: ReportAccessService,
	) {}

	async execute(
		userId: string,
		params: { type?: ReportType; limit: number },
	): Promise<AiReportDto[]> {
		await this.reportAccess.enforcePremium(userId);

		const reports = await this.aiReportRepository.findMany({
			userId,
			type: params.type,
			limit: params.limit,
		});

		return reports.map((report) => report.toView());
	}
}
