import type { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { ResourceBonus } from "../../domain/resource-bonus.aggregate.js";
import type { EntitlementCachePort } from "../ports/entitlement-cache.port.js";
import type {
  GrantResourceBonusInput,
  GrantResourceBonusResult,
} from "../ports/resource-bonus-granter.port.js";
import type { ResourceBonusRepositoryPort } from "../ports/resource-bonus.repository.port.js";

export type GrantResourceBonusCommand = GrantResourceBonusInput;

export interface GrantResourceBonusDependencies {
  readonly resourceBonusRepository: Pick<ResourceBonusRepositoryPort, "nextId" | "saveIfAbsent">;
  readonly entitlementCache: Pick<EntitlementCachePort, "invalidate">;
  readonly afterCommit: Pick<AfterCommitTaskRegistryPort, "register">;
  readonly clock: ClockPort;
}

/** 리소스 자리 보너스를 한 출처 키에 한 번만 더한다. 호출자의 UoW에 참여한다. */
export class GrantResourceBonusUseCase {
  readonly #dependencies: GrantResourceBonusDependencies;

  constructor(dependencies: GrantResourceBonusDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: GrantResourceBonusCommand): Promise<GrantResourceBonusResult> {
    const { resourceBonusRepository, entitlementCache, afterCommit, clock } = this.#dependencies;
    const userId = UserId.reconstitute(command.userId);
    const bonus = ResourceBonus.create({
      id: await resourceBonusRepository.nextId(),
      userId,
      resource: command.resource,
      quantity: command.quantity,
      sourceKey: command.sourceKey,
      now: clock.now(),
    });
    if (!(await resourceBonusRepository.saveIfAbsent(bonus))) {
      return { status: "duplicate" };
    }

    // 늘어난 자리가 커밋된 뒤에만 캐시에 보이도록 한다
    afterCommit.register(() => entitlementCache.invalidate(userId));
    return { status: "granted" };
  }
}
