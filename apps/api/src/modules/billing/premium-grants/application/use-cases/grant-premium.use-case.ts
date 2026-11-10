import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type {
  AfterCommitTaskRegistryPort,
  UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";

import { planNewGrantStart } from "../../../shared/premium-access.domain-service.js";
import { PremiumGrant } from "../../domain/premium-grant.aggregate.js";
import type { SubscriptionUserMutationLockPort } from "../ports/billing-user-lock.port.js";
import type { SubscriptionCachePort } from "../ports/premium-access-cache.port.js";
import type { PremiumGrantRepositoryPort } from "../ports/premium-grant.repository.port.js";
import type {
  GrantPremiumInput,
  GrantPremiumResult,
  PremiumGranterPort,
} from "../ports/premium-granter.port.js";
import { PremiumGrantLogEvent } from "../premium-grants.log-events.js";
import type { ProjectPremiumAccessUseCase } from "./project-premium-access.use-case.js";

interface PremiumGranterDependencies {
  readonly premiumGrantRepository: Pick<PremiumGrantRepositoryPort, "create">;
  readonly premiumAccessProjector: Pick<
    ProjectPremiumAccessUseCase,
    "loadEntitlements" | "project"
  >;
  readonly userMutationLock: SubscriptionUserMutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly afterCommitTasks: Pick<AfterCommitTaskRegistryPort, "register">;
  readonly cache: SubscriptionCachePort;
  readonly logger: ApplicationLoggerPort;
}

/** 웹훅과 같은 사용자 잠금 아래에서 보상 기간을 저장하고 프리미엄 projection을 다시 계산한다. */
export class GrantPremiumUseCase implements PremiumGranterPort {
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
          event: PremiumGrantLogEvent.PREMIUM_GRANT_RECORDED,
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
        start: planNewGrantStart(entitlements, at),
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
