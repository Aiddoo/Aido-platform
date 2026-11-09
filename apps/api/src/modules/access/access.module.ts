import { Module } from "@nestjs/common";

import {
  IdentityUserAccessModule,
  USER_MUTATION_LOCK,
} from "#api/modules/identity/identity-user-access.public";

import {
  entitlementServiceProvider,
  resourceBonusGranterProvider,
} from "./access-entitlement-application.providers.js";
import { quotaLedgerServiceProvider } from "./access-quota-application.providers.js";
import { ENTITLEMENT_CACHE } from "./application/ports/entitlement/entitlement-cache.port.js";
import { ENTITLEMENT_READER } from "./application/ports/entitlement/entitlement-reader.port.js";
import { ENTITLEMENT_DATABASE } from "./application/ports/entitlement/entitlement-state.port.js";
import { RESOURCE_BONUS_GRANTER } from "./application/ports/entitlement/resource-bonus-granter.port.js";
import { RESOURCE_BONUS_REPOSITORY } from "./application/ports/entitlement/resource-bonus.repository.port.js";
import { ENTITLEMENT_SUBSCRIPTION_INVALIDATOR } from "./application/ports/entitlement/subscription-cache-invalidator.port.js";
import { QUOTA_LEDGER } from "./application/ports/quotas/quota-ledger.port.js";
import { QUOTA_LEDGER_REPOSITORY } from "./application/ports/quotas/quota-ledger.repository.port.js";
import { QUOTA_USER_MUTATION_LOCK } from "./application/ports/quotas/quota-user-mutation-lock.port.js";
import { EntitlementService } from "./application/services/entitlement/entitlement.service.js";
import { ResourceBonusGranter } from "./application/services/entitlement/resource-bonus-granter.service.js";
import { QuotaLedgerService } from "./application/services/quotas/quota-ledger.service.js";
import { EntitlementCacheAdapter } from "./infrastructure/adapters/entitlement/entitlement-cache.adapter.js";
import { QuotaAbandonedRefundJob } from "./infrastructure/jobs/quotas/quota-abandoned-refund.job.js";
import { DrizzleEntitlementReader } from "./infrastructure/persistence/entitlement/drizzle-entitlement.reader.js";
import { DrizzleResourceBonusRepository } from "./infrastructure/persistence/entitlement/drizzle-resource-bonus.repository.js";
import { DrizzleQuotaLedgerRepository } from "./infrastructure/persistence/quotas/drizzle-quota-ledger.repository.js";

@Module({
  imports: [IdentityUserAccessModule],
  providers: [
    entitlementServiceProvider,
    quotaLedgerServiceProvider,
    QuotaAbandonedRefundJob,
    DrizzleEntitlementReader,
    EntitlementCacheAdapter,
    { provide: ENTITLEMENT_READER, useExisting: EntitlementService },
    { provide: ENTITLEMENT_SUBSCRIPTION_INVALIDATOR, useExisting: EntitlementCacheAdapter },
    { provide: ENTITLEMENT_CACHE, useExisting: EntitlementCacheAdapter },
    { provide: ENTITLEMENT_DATABASE, useExisting: DrizzleEntitlementReader },
    { provide: QUOTA_LEDGER, useExisting: QuotaLedgerService },
    { provide: QUOTA_LEDGER_REPOSITORY, useClass: DrizzleQuotaLedgerRepository },
    { provide: QUOTA_USER_MUTATION_LOCK, useExisting: USER_MUTATION_LOCK },
    { provide: RESOURCE_BONUS_REPOSITORY, useClass: DrizzleResourceBonusRepository },
    resourceBonusGranterProvider,
    { provide: RESOURCE_BONUS_GRANTER, useExisting: ResourceBonusGranter },
  ],
  exports: [
    ENTITLEMENT_READER,
    ENTITLEMENT_SUBSCRIPTION_INVALIDATOR,
    QUOTA_LEDGER,
    RESOURCE_BONUS_GRANTER,
  ],
})
export class AccessModule {}
