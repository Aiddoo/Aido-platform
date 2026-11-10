import { Module } from "@nestjs/common";

import { AccessEntitlementsModule } from "#api/modules/access/entitlements/access-entitlements.public";
import { IdentityUserAccessModule } from "#api/modules/identity/users/identity-users.public";
import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";

import { BillingUserLockPort } from "./application/ports/billing-user-lock.port.js";
import { PremiumAccessCachePort } from "./application/ports/premium-access-cache.port.js";
import { PremiumAccessReaderPort } from "./application/ports/premium-access.reader.port.js";
import { PremiumGranterPort } from "./application/ports/premium-granter.port.js";
import { NotifyEndingPremiumGrantsUseCase } from "./application/use-cases/notify-ending-premium-grants.use-case.js";
import { ProjectPremiumAccessUseCase } from "./application/use-cases/project-premium-access.use-case.js";
import { SweepBillingNoticesUseCase } from "./application/use-cases/sweep-billing-notices.use-case.js";
import { SweepPremiumGrantsUseCase } from "./application/use-cases/sweep-premium-grants.use-case.js";
import { BILLING_PREMIUM_GRANTS_PROVIDERS } from "./billing-premium-grants.providers.js";

@Module({
  imports: [IdentityUserAccessModule, AccessEntitlementsModule, NotificationDeliveryModule],
  providers: [...BILLING_PREMIUM_GRANTS_PROVIDERS],
  exports: [
    PremiumGranterPort,
    PremiumAccessReaderPort, // subscriptions slice가 같은 프리미엄 프로젝션과 안내 sweep을 쓴다
    ProjectPremiumAccessUseCase,
    SweepPremiumGrantsUseCase,
    NotifyEndingPremiumGrantsUseCase,
    SweepBillingNoticesUseCase,
    BillingUserLockPort,
    PremiumAccessCachePort,
  ],
})
export class BillingPremiumGrantsModule {}
