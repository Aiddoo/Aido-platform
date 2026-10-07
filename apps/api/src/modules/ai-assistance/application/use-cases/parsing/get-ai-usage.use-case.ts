import { ErrorCode } from "@aido/api/errors";

import type { EntitlementService } from "#api/modules/access/application/services/entitlement/entitlement.service";
import { Feature } from "#api/modules/access/application/services/entitlement/entitlement.service";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import {
  isNewBillingMonth,
  nextBillingResetIso,
} from "../../../domain/services/parsing/ai-usage-period.js";
import { AiUsage } from "../../../domain/value-objects/parsing/ai-usage.vo.js";
import { type AiUsageRepositoryPort } from "../../ports/parsing/ai-usage.repository.port.js";

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
interface GetAiUsageDependencies {
  readonly repository: AiUsageRepositoryPort;
  readonly entitlementService: EntitlementService;
}

export class GetAiUsage {
  readonly #dependencies: GetAiUsageDependencies;

  constructor(dependencies: GetAiUsageDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetAiUsageInput): Promise<AiUsage> {
    const usage = await this.#dependencies.repository.findUsage(input.userId);
    if (!usage) {
      throw new ApplicationException(ErrorCode.USER_0601, {
        userId: input.userId,
      });
    }

    const entitlement = await this.#dependencies.entitlementService.getFeatureLimit(
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
