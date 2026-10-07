import { Module } from "@nestjs/common";

import {
  IdentityUserAccessModule,
  USER_MUTATION_LOCK,
} from "#api/modules/identity/identity-user-access.public";

import { entitlementServiceProvider } from "./access-entitlement-application.providers.js";
import { aiQuotaServiceProvider } from "./access-quota-application.providers.js";
import { ENTITLEMENT_CACHE } from "./application/ports/entitlement/entitlement-cache.port.js";
import { ENTITLEMENT_READER } from "./application/ports/entitlement/entitlement-reader.port.js";
import { ENTITLEMENT_DATABASE } from "./application/ports/entitlement/entitlement-state.port.js";
import { ENTITLEMENT_SUBSCRIPTION_INVALIDATOR } from "./application/ports/entitlement/subscription-cache-invalidator.port.js";
import { AI_QUOTA_USER_MUTATION_LOCK } from "./application/ports/quotas/ai-quota-user-mutation-lock.port.js";
import { AI_QUOTA } from "./application/ports/quotas/ai-quota.port.js";
import { AI_QUOTA_REPOSITORY } from "./application/ports/quotas/ai-quota.repository.port.js";
import { EntitlementService } from "./application/services/entitlement/entitlement.service.js";
import { AiQuotaService } from "./application/services/quotas/ai-quota.service.js";
import { EntitlementCacheAdapter } from "./infrastructure/adapters/entitlement/entitlement-cache.adapter.js";
import { PrismaEntitlementReader } from "./infrastructure/persistence/entitlement/prisma-entitlement.reader.js";
import { PrismaAiQuotaRepository } from "./infrastructure/persistence/quotas/prisma-ai-quota.repository.js";

@Module({
  imports: [IdentityUserAccessModule],
  providers: [
    entitlementServiceProvider,
    aiQuotaServiceProvider,
    PrismaEntitlementReader,
    EntitlementCacheAdapter,
    { provide: ENTITLEMENT_READER, useExisting: EntitlementService },
    { provide: ENTITLEMENT_SUBSCRIPTION_INVALIDATOR, useExisting: EntitlementCacheAdapter },
    { provide: ENTITLEMENT_CACHE, useExisting: EntitlementCacheAdapter },
    { provide: ENTITLEMENT_DATABASE, useExisting: PrismaEntitlementReader },
    { provide: AI_QUOTA, useExisting: AiQuotaService },
    { provide: AI_QUOTA_REPOSITORY, useClass: PrismaAiQuotaRepository },
    { provide: AI_QUOTA_USER_MUTATION_LOCK, useExisting: USER_MUTATION_LOCK },
  ],
  exports: [ENTITLEMENT_READER, ENTITLEMENT_SUBSCRIPTION_INVALIDATOR, AI_QUOTA],
})
export class AccessModule {}
