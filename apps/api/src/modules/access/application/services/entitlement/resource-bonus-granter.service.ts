import type { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/index";

import type {
  GrantResourceBonusInput,
  GrantResourceBonusResult,
  ResourceBonusGranterPort,
} from "../../ports/entitlement/resource-bonus-granter.port.js";
import type { ResourceBonusRepositoryPort } from "../../ports/entitlement/resource-bonus.repository.port.js";
import type { EntitlementSubscriptionInvalidatorPort } from "../../ports/entitlement/subscription-cache-invalidator.port.js";

interface ResourceBonusGranterDependencies {
  readonly resourceBonusRepository: ResourceBonusRepositoryPort;
  readonly entitlementCache: EntitlementSubscriptionInvalidatorPort;
  readonly afterCommitTasks: Pick<AfterCommitTaskRegistryPort, "register">;
}

export class ResourceBonusGranter implements ResourceBonusGranterPort {
  readonly #dependencies: ResourceBonusGranterDependencies;

  constructor(dependencies: ResourceBonusGranterDependencies) {
    this.#dependencies = dependencies;
  }

  async grant(input: GrantResourceBonusInput): Promise<GrantResourceBonusResult> {
    const created = await this.#dependencies.resourceBonusRepository.create(input);
    if (!created) {
      return { status: "duplicate" };
    }

    // 늘어난 자리가 커밋된 뒤에만 캐시에 보이도록 한다
    this.#dependencies.afterCommitTasks.register(() =>
      this.#dependencies.entitlementCache.invalidateSubscription(input.userId),
    );
    return { status: "granted" };
  }
}
