import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type {
  AfterCommitTaskRegistryPort,
  UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";

import { PremiumGrant } from "../../../domain/aggregates/subscriptions/premium-grant.aggregate.js";
import { PremiumAccessPolicy } from "../../../domain/policies/subscriptions/premium-access.policy.js";
import { BillingLogEvent } from "../../observability/subscriptions/billing-log.events.js";
import type { PremiumGrantRepositoryPort } from "../../ports/subscriptions/premium-grant.repository.port.js";
import type {
  GrantPremiumInput,
  GrantPremiumResult,
  PremiumGranterPort,
} from "../../ports/subscriptions/premium-granter.port.js";
import type { SubscriptionCachePort } from "../../ports/subscriptions/subscription-cache.port.js";
import type { SubscriptionUserMutationLockPort } from "../../ports/subscriptions/subscription-user-mutation-lock.port.js";
import type { PremiumAccessProjector } from "./premium-access-projector.service.js";

interface PremiumGranterDependencies {
  readonly premiumGrantRepository: Pick<PremiumGrantRepositoryPort, "create">;
  readonly premiumAccessProjector: Pick<PremiumAccessProjector, "loadEntitlements" | "project">;
  readonly userMutationLock: SubscriptionUserMutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly afterCommitTasks: Pick<AfterCommitTaskRegistryPort, "register">;
  readonly cache: SubscriptionCachePort;
  readonly logger: ApplicationLogger;
}

/** 웹훅과 같은 사용자 잠금 아래에서 보상 기간을 저장하고 프리미엄 projection을 다시 계산한다. */
export class PremiumGranter implements PremiumGranterPort {
  readonly #dependencies: PremiumGranterDependencies;

  constructor(dependencies: PremiumGranterDependencies) {
    this.#dependencies = dependencies;
  }

  async grant(input: GrantPremiumInput): Promise<GrantPremiumResult> {
    return this.#dependencies.unitOfWork.run(async (): Promise<GrantPremiumResult> => {
      const result = await this.#record(input);
      // 호출자 UoW에 Required로 참여하므로 바깥이 rollback되면 기록되지 않은 지급을 로그에 남기지 않는다
      this.#dependencies.afterCommitTasks.register(async () => {
        this.#dependencies.logger.log({
          event: BillingLogEvent.PREMIUM_GRANT_RECORDED,
          userId: input.userId,
          source: input.source,
          durationDays: input.durationDays,
          reason: result.status,
        });
      });
      return result;
    });
  }

  async #record(input: GrantPremiumInput): Promise<GrantPremiumResult> {
    if (!(await this.#dependencies.userMutationLock.lockById(input.userId))) {
      return { status: "user-missing" };
    }

    const at = now();
    const { entitlements } = await this.#dependencies.premiumAccessProjector.loadEntitlements(
      input.userId,
    );
    const created = await this.#dependencies.premiumGrantRepository.create(
      PremiumGrant.planCreation({
        userId: input.userId,
        source: input.source,
        sourceKey: input.sourceKey,
        durationDays: input.durationDays,
        start: PremiumAccessPolicy.planNewGrantStart(entitlements, at),
      }),
    );
    if (!created) {
      return { status: "duplicate" };
    }

    await this.#dependencies.premiumAccessProjector.project({ userId: input.userId, now: at });
    // 커밋된 뒤에만 구독·프로필 캐시를 비운다
    this.#dependencies.afterCommitTasks.register(() =>
      this.#dependencies.cache.invalidate(input.userId),
    );
    return { status: "granted" };
  }
}
