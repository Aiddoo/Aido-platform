import { Module } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-entitlement.public";
import { BillingSubscriptionsModule } from "#api/modules/billing/subscriptions/billing-subscriptions.public";
import { EngagementCommentsModule } from "#api/modules/engagement/engagement-comments.public";
import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";
import { PlanningCategoriesModule } from "#api/modules/planning/categories/planning-categories.public";
import { SocialCheersModule } from "#api/modules/social/social-cheers.public";
import { SocialFriendsModule } from "#api/modules/social/social-friends.public";
import { SocialNudgesModule } from "#api/modules/social/social-nudges.public";

import { IdentityAuthModule } from "../auth/identity-auth.module.js";
import { IdentityUserAccessModule } from "./identity-user-access.module.js";
import { IDENTITY_USERS_PROVIDERS } from "./identity-users.providers.js";
import { AccountPurgeProcessor } from "./infrastructure/jobs/account-purge.processor.js";
import { AccountPurgeScheduler } from "./infrastructure/jobs/account-purge.scheduler.js";
import { LastActiveInterceptor } from "./presentation/http/interceptors/last-active.interceptor.js";
import { EntitlementController } from "./presentation/http/v1/entitlement.controller.js";
import { UserAccountController } from "./presentation/http/v1/user-account.controller.js";

// users → auth 한 방향이다. auth는 이 모듈이 아니라 IdentityUserAccessModule만 import한다
@Module({
  imports: [
    IdentityAuthModule,
    IdentityUserAccessModule,
    AccessModule,
    BillingSubscriptionsModule,
    EngagementCommentsModule,
    NotificationDeliveryModule,
    PlanningCategoriesModule,
    SocialCheersModule,
    SocialFriendsModule,
    SocialNudgesModule,
  ],
  controllers: [UserAccountController, EntitlementController],
  providers: [
    ...IDENTITY_USERS_PROVIDERS,
    AccountPurgeScheduler,
    AccountPurgeProcessor,
    LastActiveInterceptor,
  ],
  exports: [IdentityUserAccessModule, LastActiveInterceptor],
})
export class IdentityUsersModule {}
