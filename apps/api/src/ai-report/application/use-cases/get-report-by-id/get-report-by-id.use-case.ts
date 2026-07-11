import { ErrorCode } from "@aido/errors";
import type { AiReport as AiReportDto } from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import {
	AI_REPORT_REPOSITORY,
	type AiReportRepositoryPort,
} from "../../ports/ai-report.repository.port";
import { ReportAccessService } from "../../services/report-access.service";

/**
 * 리포트 상세 조회 use-case.
 */
@Injectable()
export class GetReportByIdUseCase {
	constructor(
		@Inject(AI_REPORT_REPOSITORY)
		private readonly aiReportRepository: AiReportRepositoryPort,
		private readonly reportAccess: ReportAccessService,
	) {}

	async execute(userId: string, id: number): Promise<AiReportDto> {
		await this.reportAccess.enforcePremium(userId);

		const report = await this.aiReportRepository.findByIdAndUserId(id, userId);

		if (!report) {
			throw new ApplicationException(ErrorCode.AI_1304, { reportId: id });
		}

		return report.toView();
	}
}
