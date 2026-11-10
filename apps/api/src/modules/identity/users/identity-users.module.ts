import { Module } from "@nestjs/common";

import { AccessQuotasModule } from "#api/modules/access/quotas/access-quotas.public";
import { BillingPremiumGrantsModule } from "#api/modules/billing/premium-grants/billing-premium-grants.public";
import { EngagementCommentsModule } from "#api/modules/engagement/comments/engagement-comments.public";
import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";
import { SocialCheersModule } from "#api/modules/social/cheers/social-cheers.public";
import { SocialNudgesModule } from "#api/modules/social/nudges/social-nudges.public";

import { IdentityAuthModule } from "../auth/identity-auth.module.js";
import { IdentityUserAccessModule } from "./identity-user-access.module.js";
import { IDENTITY_USERS_PROVIDERS } from "./identity-users.providers.js";
import { AccountPurgeProcessor } from "./infrastructure/jobs/account-purge.processor.js";
import { AccountPurgeScheduler } from "./infrastructure/jobs/account-purge.scheduler.js";
import { LastActiveInterceptor } from "./presentation/http/interceptors/last-active.interceptor.js";
import { UserAccountController } from "./presentation/http/v1/user-account.controller.js";

// users → auth 한 방향이다. auth는 이 모듈이 아니라 IdentityUserAccessModule만 import한다
@Module({
  imports: [
    IdentityAuthModule,
    IdentityUserAccessModule,
    AccessQuotasModule,
    BillingPremiumGrantsModule,
    EngagementCommentsModule,
    NotificationDeliveryModule,
    SocialCheersModule,
    SocialNudgesModule,
  ],
  controllers: [UserAccountController],
  providers: [
    ...IDENTITY_USERS_PROVIDERS,
    AccountPurgeScheduler,
    AccountPurgeProcessor,
    LastActiveInterceptor,
  ],
  exports: [IdentityUserAccessModule, LastActiveInterceptor],
})
export class IdentityUsersModule {}
