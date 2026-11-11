import type { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";

import { FeatureGrant } from "../../domain/feature-grant.aggregate.js";
import type { EntitlementCachePort } from "../ports/entitlement-cache.port.js";
import type { FeatureGrantRepositoryPort } from "../ports/feature-grant.repository.port.js";
import type { FeatureGrantInput, FeatureGrantResult } from "../ports/feature-granter.port.js";

export type GrantFeatureCommand = FeatureGrantInput;

export interface GrantFeatureDependencies {
  readonly featureGrantRepository: Pick<FeatureGrantRepositoryPort, "nextId" | "saveIfAbsent">;
  readonly entitlementCache: Pick<EntitlementCachePort, "invalidate">;
  readonly afterCommit: Pick<AfterCommitTaskRegistryPort, "register">;
  readonly clock: ClockPort;
}

/** 기능 한도에 자리를 한 출처 키에 한 번만 더한다. 호출자의 UoW에 참여한다. */
export class GrantFeatureUseCase {
  readonly #dependencies: GrantFeatureDependencies;

  constructor(dependencies: GrantFeatureDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: GrantFeatureCommand): Promise<FeatureGrantResult> {
    const { featureGrantRepository, entitlementCache, afterCommit, clock } = this.#dependencies;
    const { userId } = command;
    const grant = FeatureGrant.create({
      id: await featureGrantRepository.nextId(),
      userId,
      feature: command.feature,
      quantity: command.quantity,
      sourceKey: command.sourceKey,
      now: clock.now(),
    });
    if (!(await featureGrantRepository.saveIfAbsent(grant))) {
      return { status: "duplicate" };
    }
    // 늘어난 자리가 커밋된 뒤에만 캐시에 보이도록 한다
    afterCommit.register(() => entitlementCache.invalidate(userId));
    return { status: "granted" };
  }
}
