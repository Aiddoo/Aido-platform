/**
 * AI 사용량 미터 (애플리케이션 서비스)
 *
 * parse-todo / parse-memo 유스케이스가 공유하는 사용량 한도 확인 + 원자적 증가와
 * 실패 시 보상 감소를 캡슐화한다(SRP/DRY). 한도 판정 자체는 순수 도메인 규칙을
 * 사용하고, 저장소 접근은 포트로 역전한다.
 */
import { ErrorCode } from "@aido/errors";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { EntitlementService, Feature } from "@/shared/application/entitlement/entitlement.service";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { now } from "@/shared/domain/date/utils/core";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import { isNewBillingMonth } from "../../domain/services/ai-usage-period";
import { AI_USAGE_REPOSITORY, type AiUsageRepositoryPort } from "../ports/ai-usage.repository.port";

@Injectable()
export class AiUsageMeter {
	readonly #logger = new Logger(AiUsageMeter.name);

	constructor(
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
		@Inject(AI_USAGE_REPOSITORY)
		private readonly repository: AiUsageRepositoryPort,
		private readonly entitlementService: EntitlementService,
	) {}

	/** 사용자별 월간 한도(무제한이면 null). */
	async monthlyLimit(userId: string): Promise<number | null> {
		const entitlement = await this.entitlementService.getFeatureLimit(userId, Feature.AI_PARSE);
		return entitlement.dailyLimit;
	}

	/**
	 * 사용량 한도를 확인하고 원자적으로 1 증가시킨다.
	 *
	 * 트랜잭션으로 확인+증가를 원자화하여 동시 요청에서도 한도를 정확히 적용한다.
	 * 새로운 달이면 리셋 후 1로 설정한다.
	 *
	 * @throws AI_1303 월간 사용량 초과
	 * @throws USER_0601 사용자 없음
	 */
	async checkAndIncrement(userId: string): Promise<void> {
		const monthlyLimit = await this.monthlyLimit(userId);

		await this.uow.run(async () => {
			const usage = await this.repository.findUsage(userId);
			if (!usage) {
				throw new ApplicationException(ErrorCode.USER_0601, { userId });
			}

			const isNewMonth = isNewBillingMonth(usage.resetAt, now());
			const currentUsage = isNewMonth ? 0 : usage.count;

			if (monthlyLimit !== null && currentUsage >= monthlyLimit) {
				throw new ApplicationException(ErrorCode.AI_1303, {
					used: currentUsage,
					limit: monthlyLimit,
				});
			}

			if (isNewMonth) {
				await this.repository.resetAndIncrement(userId);
			} else {
				await this.repository.increment(userId);
			}
		});
	}

	/**
	 * AI 호출 실패 시 사용량을 롤백(1 감소)한다.
	 * 롤백 자체가 실패해도 원래 에러 전파에 영향을 주지 않는다.
	 */
	async decrement(userId: string): Promise<void> {
		try {
			await this.repository.decrement(userId);
			this.#logger.debug(`AI usage decremented for user: ${userId}`);
		} catch (rollbackError) {
			this.#logger.error(`Failed to rollback AI usage for ${userId}:`, rollbackError);
		}
	}
}
