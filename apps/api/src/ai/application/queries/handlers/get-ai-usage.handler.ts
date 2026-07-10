import { ErrorCode } from "@aido/errors";
import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import {
	EntitlementService,
	Feature,
} from "@/shared/application/entitlement/entitlement.service";
import { now } from "@/shared/domain/date/utils/core";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import {
	isNewBillingMonth,
	nextBillingResetIso,
} from "../../../domain/services/ai-usage-period";
import { AiUsage } from "../../../domain/value-objects/ai-usage.vo";
import {
	AI_USAGE_REPOSITORY,
	type AiUsageRepositoryPort,
} from "../../ports/ai-usage.repository.port";
import { GetAiUsageQuery } from "../get-ai-usage.query";

/**
 * AI 사용량 조회 핸들러.
 *
 * 새로운 달이면 used=0으로 표시하고, 다음 리셋 시각(KST 1일 00:00)을 함께 반환한다.
 */
@QueryHandler(GetAiUsageQuery)
export class GetAiUsageHandler
	implements IQueryHandler<GetAiUsageQuery, AiUsage>
{
	constructor(
		@Inject(AI_USAGE_REPOSITORY)
		private readonly repository: AiUsageRepositoryPort,
		private readonly entitlementService: EntitlementService,
	) {}

	async execute(query: GetAiUsageQuery): Promise<AiUsage> {
		const usage = await this.repository.findUsage(query.userId);
		if (!usage) {
			throw new ApplicationException(ErrorCode.USER_0601, {
				userId: query.userId,
			});
		}

		const entitlement = await this.entitlementService.getFeatureLimit(
			query.userId,
			Feature.AI_PARSE,
		);
		const reference = now();
		const isNewMonth = isNewBillingMonth(usage.resetAt, reference);

		return AiUsage.of(
			isNewMonth ? 0 : usage.count,
			entitlement.dailyLimit,
			nextBillingResetIso(reference),
		);
	}
}
