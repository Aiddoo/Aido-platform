import { ErrorCode } from "@aido/errors";
import type { AiReport as AiReportDto } from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";
import { EntitlementService } from "@/shared/application/entitlement/entitlement.service";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import {
	AI_REPORT_REPOSITORY,
	type AiReportRepositoryPort,
} from "../../ports/ai-report.repository.port";

/**
 * 리포트 상세 조회 use-case.
 */
@Injectable()
export class GetReportByIdUseCase {
	constructor(
		@Inject(AI_REPORT_REPOSITORY)
		private readonly aiReportRepository: AiReportRepositoryPort,
		private readonly entitlementService: EntitlementService,
	) {}

	async execute(userId: string, id: number): Promise<AiReportDto> {
		const hasPremium = await this.entitlementService.hasPremiumAccess(userId);
		if (!hasPremium) {
			throw new ApplicationException(ErrorCode.AI_1308);
		}

		const report = await this.aiReportRepository.findByIdAndUserId(id, userId);

		if (!report) {
			throw new ApplicationException(ErrorCode.AI_1304, { reportId: id });
		}

		return report.toView();
	}
}
