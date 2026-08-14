import { ErrorCode } from "@aido/errors";
import { Inject, Injectable } from "@nestjs/common";

import { EntitlementService, Feature } from "@/shared/application/entitlement/entitlement.service";
import { now } from "@/shared/domain/date/utils/core";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import { isNewBillingMonth, nextBillingResetIso } from "../../../domain/services/ai-usage-period";
import { AiUsage } from "../../../domain/value-objects/ai-usage.vo";
import {
	AI_USAGE_REPOSITORY,
	type AiUsageRepositoryPort,
} from "../../ports/ai-usage.repository.port";

/**
 * 현재 사용자의 월간 AI 사용량 조회 입력.
 */
export interface GetAiUsageInput {
	userId: string;
}

/**
 * AI 사용량 조회 use-case.
 *
 * 새로운 달이면 used=0으로 표시하고, 다음 리셋 시각(KST 1일 00:00)을 함께 반환한다.
 */
@Injectable()
export class GetAiUsageUseCase {
	constructor(
		@Inject(AI_USAGE_REPOSITORY)
		private readonly repository: AiUsageRepositoryPort,
		private readonly entitlementService: EntitlementService,
	) {}

	async execute(input: GetAiUsageInput): Promise<AiUsage> {
		const usage = await this.repository.findUsage(input.userId);
		if (!usage) {
			throw new ApplicationException(ErrorCode.USER_0601, {
				userId: input.userId,
			});
		}

		const entitlement = await this.entitlementService.getFeatureLimit(
			input.userId,
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
