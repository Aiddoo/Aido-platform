import { Module } from "@nestjs/common";

import { AccessFeatureGrantsQueriesModule } from "#api/modules/access/feature-grants/access-feature-grants.public";
import { IdentityUserAccessModule } from "#api/modules/identity/users/identity-users.public";
import { NotificationNotificationsModule } from "#api/modules/notification/notifications/notification-notifications.public";
import { NotificationPushDispatchesModule } from "#api/modules/notification/push-dispatches/notification-push-dispatches.public";

import { SweepBillingNoticesUseCase } from "../shared/application/use-cases/sweep-billing-notices.use-case.js";
import { PremiumAccessCachePort } from "./application/ports/premium-access-cache.port.js";
import { PremiumAccessReaderPort } from "./application/ports/premium-access.reader.port.js";
import { PremiumGranterPort } from "./application/ports/premium-granter.port.js";
import { NotifyEndingPremiumGrantsUseCase } from "./application/use-cases/notify-ending-premium-grants.use-case.js";
import { ProjectPremiumAccessUseCase } from "./application/use-cases/project-premium-access.use-case.js";
import { SweepPremiumGrantsUseCase } from "./application/use-cases/sweep-premium-grants.use-case.js";
import { BILLING_PREMIUM_GRANTS_PROVIDERS } from "./billing-premium-grants.providers.js";

@Module({
  imports: [
    IdentityUserAccessModule,
    AccessFeatureGrantsQueriesModule,
    NotificationNotificationsModule,
    NotificationPushDispatchesModule,
  ],
  providers: [...BILLING_PREMIUM_GRANTS_PROVIDERS],
  exports: [
    PremiumGranterPort,
    PremiumAccessReaderPort,
    // subscriptions slice가 같은 프리미엄 projection·캐시 비우기와 안내 sweep을 쓴다
    ProjectPremiumAccessUseCase,
    SweepPremiumGrantsUseCase,
    NotifyEndingPremiumGrantsUseCase,
    SweepBillingNoticesUseCase,
    PremiumAccessCachePort,
  ],
})
export class BillingPremiumGrantsModule {}
