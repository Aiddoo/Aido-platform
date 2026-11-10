import { type FactoryProvider } from "@nestjs/common";

import { AFTER_COMMIT_TASK_REGISTRY } from "#api/shared/application/ports/index";

import { ENTITLEMENT_DATABASE } from "./application/ports/access-state.reader.port.js";
import { ENTITLEMENT_SUBSCRIPTION_INVALIDATOR } from "./application/ports/entitlement-cache-invalidator.port.js";
import { ENTITLEMENT_CACHE } from "./application/ports/entitlement-cache.port.js";
import { RESOURCE_BONUS_REPOSITORY } from "./application/ports/resource-bonus.repository.port.js";
import { ResourceBonusGranter } from "./application/use-cases/grant-resource-bonus.use-case.js";
import { EntitlementService } from "./infrastructure/adapters/entitlement-reader.adapter.js";

export const entitlementServiceProvider: FactoryProvider<EntitlementService> = {
  provide: EntitlementService,
  inject: [ENTITLEMENT_CACHE, ENTITLEMENT_DATABASE],
  useFactory: (
    cacheService: ConstructorParameters<typeof EntitlementService>[0]["cacheService"],
    database: ConstructorParameters<typeof EntitlementService>[0]["database"],
  ) => new EntitlementService({ cacheService, database }),
};

export const resourceBonusGranterProvider: FactoryProvider<ResourceBonusGranter> = {
  provide: ResourceBonusGranter,
  inject: [
    RESOURCE_BONUS_REPOSITORY,
    ENTITLEMENT_SUBSCRIPTION_INVALIDATOR,
    AFTER_COMMIT_TASK_REGISTRY,
  ],
  useFactory: (
    resourceBonusRepository: ConstructorParameters<
      typeof ResourceBonusGranter
    >[0]["resourceBonusRepository"],
    entitlementCache: ConstructorParameters<typeof ResourceBonusGranter>[0]["entitlementCache"],
    afterCommitTasks: ConstructorParameters<typeof ResourceBonusGranter>[0]["afterCommitTasks"],
  ) => new ResourceBonusGranter({ resourceBonusRepository, entitlementCache, afterCommitTasks }),
};
