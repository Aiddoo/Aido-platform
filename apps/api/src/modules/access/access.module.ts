import { Module } from "@nestjs/common";

import {
  IdentityUserAccessModule,
  USER_MUTATION_LOCK,
} from "#api/modules/identity/identity-user-access.public";

import {
  entitlementServiceProvider,
  resourceBonusGranterProvider,
} from "./entitlements/access-entitlements.providers.js";
import { ENTITLEMENT_DATABASE } from "./entitlements/application/ports/access-state.reader.port.js";
import { ENTITLEMENT_SUBSCRIPTION_INVALIDATOR } from "./entitlements/application/ports/entitlement-cache-invalidator.port.js";
import { ENTITLEMENT_CACHE } from "./entitlements/application/ports/entitlement-cache.port.js";
import { ENTITLEMENT_READER } from "./entitlements/application/ports/entitlement.reader.port.js";
import { RESOURCE_BONUS_GRANTER } from "./entitlements/application/ports/resource-bonus-granter.port.js";
import { RESOURCE_BONUS_REPOSITORY } from "./entitlements/application/ports/resource-bonus.repository.port.js";
import { ResourceBonusGranter } from "./entitlements/application/use-cases/grant-resource-bonus.use-case.js";
import { EntitlementCacheAdapter } from "./entitlements/infrastructure/adapters/entitlement-cache.adapter.js";
import { EntitlementService } from "./entitlements/infrastructure/adapters/entitlement-reader.adapter.js";
import { DrizzleEntitlementReader } from "./entitlements/infrastructure/persistence/drizzle-access-state.reader.js";
import { DrizzleResourceBonusRepository } from "./entitlements/infrastructure/persistence/drizzle-resource-bonus.repository.js";
import { quotaLedgerServiceProvider } from "./quotas/access-quotas.providers.js";
import { QUOTA_LEDGER } from "./quotas/application/ports/quota-ledger.port.js";
import { QUOTA_LEDGER_REPOSITORY } from "./quotas/application/ports/quota-ledger.repository.port.js";
import { QUOTA_USER_MUTATION_LOCK } from "./quotas/application/ports/quota-user-mutation-lock.port.js";
import { QuotaLedgerService } from "./quotas/infrastructure/adapters/quota-ledger.adapter.js";
import { QuotaAbandonedRefundJob } from "./quotas/infrastructure/jobs/quota-abandoned-refund.processor.js";
import { DrizzleQuotaLedgerRepository } from "./quotas/infrastructure/persistence/drizzle-quota-ledger.repository.js";

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
