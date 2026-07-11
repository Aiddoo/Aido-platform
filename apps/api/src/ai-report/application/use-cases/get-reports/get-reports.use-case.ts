import { ErrorCode } from "@aido/errors";
import type { AiReport as AiReportDto } from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";
import { EntitlementService } from "@/shared/application/entitlement/entitlement.service";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import type { ReportType } from "../../../domain/types";
import {
	AI_REPORT_REPOSITORY,
	type AiReportRepositoryPort,
} from "../../ports/ai-report.repository.port";

/**
 * 리포트 목록 조회 use-case.
 */
@Injectable()
export class GetReportsUseCase {
	constructor(
		@Inject(AI_REPORT_REPOSITORY)
		private readonly aiReportRepository: AiReportRepositoryPort,
		private readonly entitlementService: EntitlementService,
	) {}

	async execute(
		userId: string,
		params: { type?: ReportType; limit: number },
	): Promise<AiReportDto[]> {
		const hasPremium = await this.entitlementService.hasPremiumAccess(userId);
		if (!hasPremium) {
			throw new ApplicationException(ErrorCode.AI_1308);
		}

		const reports = await this.aiReportRepository.findMany({
			userId,
			type: params.type,
			limit: params.limit,
		});

		return reports.map((report) => report.toView());
	}
}
