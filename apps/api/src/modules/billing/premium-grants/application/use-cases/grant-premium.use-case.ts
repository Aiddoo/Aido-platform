import type { UserMutationLockPort } from "#api/modules/identity/users/identity-users.public";
import type { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { planNewGrantStart } from "../../../shared/premium-access.domain-service.js";
import { PremiumGrant } from "../../domain/premium-grant.aggregate.js";
import type { PremiumAccessCachePort } from "../ports/premium-access-cache.port.js";
import type { PremiumGrantRepositoryPort } from "../ports/premium-grant.repository.port.js";
import type { GrantPremiumInput, GrantPremiumResult } from "../ports/premium-granter.port.js";
import { PremiumGrantLogEvent } from "../premium-grants.log-events.js";
import type { LoadPremiumEntitlementsUseCase } from "./load-premium-entitlements.use-case.js";
import type { ProjectPremiumAccessUseCase } from "./project-premium-access.use-case.js";

export type GrantPremiumCommand = GrantPremiumInput;

export interface GrantPremiumDependencies {
  readonly premiumGrantRepository: Pick<PremiumGrantRepositoryPort, "nextId" | "saveIfAbsent">;
  readonly loadPremiumEntitlements: Pick<LoadPremiumEntitlementsUseCase, "execute">;
  readonly projectPremiumAccess: Pick<ProjectPremiumAccessUseCase, "execute">;
  readonly userLock: Pick<UserMutationLockPort, "lockById">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly afterCommit: Pick<AfterCommitTaskRegistryPort, "register">;
  readonly cache: PremiumAccessCachePort;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

/** 웹훅과 같은 사용자 잠금 아래에서 보상 기간을 저장하고 프리미엄 projection을 다시 계산한다. */
export class GrantPremiumUseCase {
  readonly #dependencies: GrantPremiumDependencies;

  constructor(dependencies: GrantPremiumDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: GrantPremiumCommand): Promise<GrantPremiumResult> {
    const { unitOfWork, afterCommit, logger } = this.#dependencies;
    return unitOfWork.run(async (): Promise<GrantPremiumResult> => {
      const result = await this.#record(command);
      // 호출자 UoW에 Required로 참여하므로 바깥이 rollback되면 기록되지 않은 지급을 로그에 남기지 않는다
      afterCommit.register(async () => {
        logger.log({
          event: PremiumGrantLogEvent.PREMIUM_GRANT_RECORDED,
          userId: command.userId.value,
          source: command.source,
          durationDays: command.durationDays,
          reason: result.status,
        });
      });
      return result;
    });
  }

  async #record(command: GrantPremiumCommand): Promise<GrantPremiumResult> {
    const {
      userLock,
      clock,
      loadPremiumEntitlements,
      premiumGrantRepository,
      projectPremiumAccess,
      afterCommit,
      cache,
    } = this.#dependencies;
    const { userId } = command;
    if (!(await userLock.lockById(userId))) {
      return { status: "user-missing" };
    }
    const now = clock.now();
    const { entitlements } = await loadPremiumEntitlements.execute({ userId });
    const created = await premiumGrantRepository.saveIfAbsent(
      PremiumGrant.create({
        id: await premiumGrantRepository.nextId(),
        userId,
        source: command.source,
        sourceKey: command.sourceKey,
        durationDays: command.durationDays,
        start: planNewGrantStart(entitlements, now),
        now,
      }),
    );
    if (!created) {
      return { status: "duplicate" };
    }

    await projectPremiumAccess.execute({ userId, now });
    // 커밋된 뒤에만 구독·프로필 캐시를 비운다
    afterCommit.register(() => cache.invalidate(userId));
    return { status: "granted" };
  }
}
