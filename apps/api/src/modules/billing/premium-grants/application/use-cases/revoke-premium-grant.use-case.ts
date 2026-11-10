import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { bankedRemainderSourceKey } from "../../domain/premium-grant.aggregate.js";
import type { SubscriptionUserMutationLockPort } from "../ports/billing-user-lock.port.js";
import type { SubscriptionCachePort } from "../ports/premium-access-cache.port.js";
import type { PremiumGrantRepositoryPort } from "../ports/premium-grant.repository.port.js";
import { PremiumGrantLogEvent } from "../premium-grants.log-events.js";
import type { ProjectPremiumAccessUseCase } from "./project-premium-access.use-case.js";

export interface RevokePremiumGrantInput {
  /** 지급할 때 쓴 출처 키(예: invite:…) */
  readonly sourceKey: string;
  readonly now: Date;
}

export type RevokePremiumGrantResult =
  | { readonly status: "revoked"; readonly userId: string; readonly revokedGrantCount: number }
  | { readonly status: "unchanged" }
  | { readonly status: "not-found" };

interface RevokePremiumGrantDependencies {
  readonly premiumGrantRepository: Pick<PremiumGrantRepositoryPort, "findBySourceKey" | "saveAll">;
  readonly premiumAccessProjector: Pick<ProjectPremiumAccessUseCase, "project">;
  readonly userMutationLock: SubscriptionUserMutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly cache: SubscriptionCachePort;
  readonly logger: ApplicationLoggerPort;
}

/**
 * 잘못 준 보상 기간을 취소한다(운영 전용, 공개 HTTP 경로 없음). 데이터를 지우지 않고 REVOKED로 남긴다.
 * 진행 중에 끊어 다시 쌓아 둔 남은 기간도 함께 취소하고, 같은 요청을 다시 보내도 바꾸지 않는다.
 */
export class RevokePremiumGrantUseCase {
  readonly #dependencies: RevokePremiumGrantDependencies;

  constructor(dependencies: RevokePremiumGrantDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RevokePremiumGrantInput): Promise<RevokePremiumGrantResult> {
    const { premiumGrantRepository, unitOfWork, userMutationLock } = this.#dependencies;
    const found = await premiumGrantRepository.findBySourceKey(input.sourceKey);
    if (found == null) {
      return { status: "not-found" };
    }
    const { userId } = found;

    const revokedGrantCount = await unitOfWork.run(async () => {
      if (!(await userMutationLock.lockById(userId))) {
        return 0;
      }
      // 잠금 뒤 최신 상태로 다시 판단해 정리 작업·다른 취소와 겹쳐도 한 번만 바꾼다
      const grant = await premiumGrantRepository.findBySourceKey(input.sourceKey);
      if (grant == null) {
        return 0;
      }
      const remainder = await premiumGrantRepository.findBySourceKey(
        bankedRemainderSourceKey(grant.id),
      );
      const revoked = [grant, ...(remainder == null ? [] : [remainder])].filter((target) =>
        target.revoke(input.now),
      );
      if (revoked.length === 0) {
        return 0;
      }
      await premiumGrantRepository.saveAll(revoked);
      await this.#dependencies.premiumAccessProjector.project({ userId, now: input.now });
      return revoked.length;
    });
    if (revokedGrantCount === 0) {
      return { status: "unchanged" };
    }

    try {
      await this.#dependencies.cache.invalidate(userId);
    } catch (error) {
      this.#dependencies.logger.warn({
        event: PremiumGrantLogEvent.PREMIUM_GRANT_CACHE_INVALIDATION_FAILED,
        userId,
        errorType: toErrorType(error),
      });
    }
    this.#dependencies.logger.log({
      event: PremiumGrantLogEvent.PREMIUM_GRANT_REVOKED,
      userId,
      revokedGrantCount,
    });
    return { status: "revoked", userId, revokedGrantCount };
  }
}
