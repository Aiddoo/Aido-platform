import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  resolvePremiumAccess,
  type PremiumAccess,
} from "../../../shared/premium-access.domain-service.js";
import type { PremiumGrantRepositoryPort } from "../ports/premium-grant.repository.port.js";
import type { LoadPremiumEntitlementsUseCase } from "./load-premium-entitlements.use-case.js";

export interface GetPremiumAccessQuery {
  readonly userId: string;
}

export interface GetPremiumAccessDependencies {
  readonly loadPremiumEntitlements: Pick<LoadPremiumEntitlementsUseCase, "execute">;
  readonly premiumGrantRepository: Pick<PremiumGrantRepositoryPort, "findLastEndedAt">;
  readonly clock: ClockPort;
}

/** 스토어 구독과 보상 기간을 함께 본 현재 프리미엄 출처·종료 시각. 조회만 하고 정리는 쓰지 않는다. */
export class GetPremiumAccessUseCase {
  readonly #dependencies: GetPremiumAccessDependencies;

  constructor(dependencies: GetPremiumAccessDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetPremiumAccessQuery): Promise<PremiumAccess> {
    const { loadPremiumEntitlements, premiumGrantRepository, clock } = this.#dependencies;
    const userId = UserId.reconstitute(query.userId);
    const [{ entitlements }, lastEndedGrantAt] = await Promise.all([
      loadPremiumEntitlements.execute({ userId }),
      premiumGrantRepository.findLastEndedAt(userId),
    ]);
    return resolvePremiumAccess({ ...entitlements, lastEndedGrantAt }, clock.now());
  }
}
