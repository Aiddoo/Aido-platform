import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AccessEntitlementsModule } from "#api/modules/access/entitlements/access-entitlements.public";
import { BillingPremiumGrantsModule } from "#api/modules/billing/premium-grants/billing-premium-grants.public";
import { NotificationPushModule } from "#api/modules/notification/notification-delivery.public";
import { SocialBlockQueriesModule } from "#api/modules/social/blocks/social-block-queries.public";
import { SocialFriendsModule } from "#api/modules/social/friends/social-friends.public";
import {
  SocialInvitesModule,
  socialInvitesConfig,
} from "#api/modules/social/invites/social-invites.public";
import { provideEventSubscriptions } from "#api/platform/events/event-subscription.catalog";

import {
  INVITEE_ACTIVITY_SUBSCRIPTION,
  InviteeActivityEventHandler,
} from "./infrastructure/event-handlers/invitee-activity.event-handler.js";
import { InviteMaintenanceProcessor } from "./infrastructure/jobs/invite-maintenance.processor.js";
import { InviteMaintenanceScheduler } from "./infrastructure/jobs/invite-maintenance.scheduler.js";
import { InviteRewardProcessor } from "./infrastructure/jobs/invite-reward.processor.js";
import { InviteRedemptionController } from "./presentation/http/v1/invite-redemption.controller.js";
import { SocialInviteRedemptionQueriesModule } from "./social-invite-redemption-queries.module.js";
import { SOCIAL_INVITE_REDEMPTIONS_PROVIDERS } from "./social-invite-redemptions.providers.js";

// 초대 수락·사용 시작·보상 지급 원장을 소유한다. 초대 코드는 SocialInvitesModule의 공개 조회로 읽는다
@Module({
  imports: [
    SocialInvitesModule,
    SocialInviteRedemptionQueriesModule,
    SocialBlockQueriesModule,
    SocialFriendsModule,
    NotificationPushModule,
    AccessEntitlementsModule,
    BillingPremiumGrantsModule,
    ConfigModule.forFeature(socialInvitesConfig),
  ],
  controllers: [InviteRedemptionController],
  providers: [
    ...SOCIAL_INVITE_REDEMPTIONS_PROVIDERS,
    provideEventSubscriptions(INVITEE_ACTIVITY_SUBSCRIPTION),
    InviteeActivityEventHandler,
    InviteRewardProcessor,
    InviteMaintenanceScheduler,
    InviteMaintenanceProcessor,
  ],
})
export class SocialInviteRedemptionsModule {}
