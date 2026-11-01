import { Module } from "@nestjs/common";

import {
  IdentityUserAccessModule,
  USER_MUTATION_LOCK,
} from "#api/modules/identity/identity-user-access.public";

import {
  entitlementServiceProvider,
  resourceBonusGranterProvider,
} from "./access-entitlement-application.providers.js";
import { aiQuotaServiceProvider } from "./access-quota-application.providers.js";
import { ENTITLEMENT_CACHE } from "./application/ports/entitlement/entitlement-cache.port.js";
import { ENTITLEMENT_READER } from "./application/ports/entitlement/entitlement-reader.port.js";
import { ENTITLEMENT_DATABASE } from "./application/ports/entitlement/entitlement-state.port.js";
import { RESOURCE_BONUS_GRANTER } from "./application/ports/entitlement/resource-bonus-granter.port.js";
import { RESOURCE_BONUS_REPOSITORY } from "./application/ports/entitlement/resource-bonus.repository.port.js";
import { ENTITLEMENT_SUBSCRIPTION_INVALIDATOR } from "./application/ports/entitlement/subscription-cache-invalidator.port.js";
import { AI_QUOTA_USER_MUTATION_LOCK } from "./application/ports/quotas/ai-quota-user-mutation-lock.port.js";
import { AI_QUOTA } from "./application/ports/quotas/ai-quota.port.js";
import { AI_QUOTA_REPOSITORY } from "./application/ports/quotas/ai-quota.repository.port.js";
import { EntitlementService } from "./application/services/entitlement/entitlement.service.js";
import { ResourceBonusGranter } from "./application/services/entitlement/resource-bonus-granter.service.js";
import { AiQuotaService } from "./application/services/quotas/ai-quota.service.js";
import { EntitlementCacheAdapter } from "./infrastructure/adapters/entitlement/entitlement-cache.adapter.js";
import { DrizzleEntitlementReader } from "./infrastructure/persistence/entitlement/drizzle-entitlement.reader.js";
import { DrizzleResourceBonusRepository } from "./infrastructure/persistence/entitlement/drizzle-resource-bonus.repository.js";
import { DrizzleAiQuotaRepository } from "./infrastructure/persistence/quotas/drizzle-ai-quota.repository.js";

@Module({
  imports: [IdentityUserAccessModule],
  providers: [
    entitlementServiceProvider,
    aiQuotaServiceProvider,
    DrizzleEntitlementReader,
    EntitlementCacheAdapter,
    { provide: ENTITLEMENT_READER, useExisting: EntitlementService },
    { provide: ENTITLEMENT_SUBSCRIPTION_INVALIDATOR, useExisting: EntitlementCacheAdapter },
    { provide: ENTITLEMENT_CACHE, useExisting: EntitlementCacheAdapter },
    { provide: ENTITLEMENT_DATABASE, useExisting: DrizzleEntitlementReader },
    { provide: AI_QUOTA, useExisting: AiQuotaService },
    { provide: AI_QUOTA_REPOSITORY, useClass: DrizzleAiQuotaRepository },
    { provide: AI_QUOTA_USER_MUTATION_LOCK, useExisting: USER_MUTATION_LOCK },
    { provide: RESOURCE_BONUS_REPOSITORY, useClass: DrizzleResourceBonusRepository },
    resourceBonusGranterProvider,
    { provide: RESOURCE_BONUS_GRANTER, useExisting: ResourceBonusGranter },
  ],
  exports: [
    ENTITLEMENT_READER,
    ENTITLEMENT_SUBSCRIPTION_INVALIDATOR,
    AI_QUOTA,
    RESOURCE_BONUS_GRANTER,
  ],
})
export class AccessModule {}
