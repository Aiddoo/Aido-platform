import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AccessFeatureGrantsQueriesModule } from "#api/modules/access/feature-grants/access-feature-grants.public";
import { BillingPremiumGrantsModule } from "#api/modules/billing/premium-grants/billing-premium-grants.public";
import { IdentityUsersQueriesModule } from "#api/modules/identity/users/identity-users.public";
import { NotificationNotificationsModule } from "#api/modules/notification/notifications/notification-notifications.public";
import { NotificationPushDispatchesModule } from "#api/modules/notification/push-dispatches/notification-push-dispatches.public";
import { SocialFriendshipsModule } from "#api/modules/social/friendships/social-friendships.public";
import {
  SocialInvitesModule,
  socialInvitesConfig,
} from "#api/modules/social/invites/social-invites.public";
import { SocialUserBlocksQueriesModule } from "#api/modules/social/user-blocks/social-user-blocks.public";
import { provideEventSubscriptions } from "#api/platform/events/event-subscription.catalog";

import {
  INVITEE_ACTIVITY_SUBSCRIPTION,
  InviteeActivityEventHandler,
} from "./infrastructure/event-handlers/invitee-activity.event-handler.js";
import { InviteMaintenanceProcessor } from "./infrastructure/jobs/invite-maintenance.processor.js";
import { InviteMaintenanceScheduler } from "./infrastructure/jobs/invite-maintenance.scheduler.js";
import { InviteRewardProcessor } from "./infrastructure/jobs/invite-reward.processor.js";
import { InviteRedemptionController } from "./presentation/http/v1/invite-redemption.controller.js";
import { SocialInviteRedemptionsQueriesModule } from "./social-invite-redemptions-queries.module.js";
import { SOCIAL_INVITE_REDEMPTIONS_PROVIDERS } from "./social-invite-redemptions.providers.js";

// 초대 수락·사용 시작·보상 지급 원장을 소유한다. 초대 코드는 SocialInvitesModule의 공개 조회로 읽는다
@Module({
  imports: [
    IdentityUsersQueriesModule,
    SocialInvitesModule,
    SocialInviteRedemptionsQueriesModule,
    SocialUserBlocksQueriesModule,
    SocialFriendshipsModule,
    NotificationNotificationsModule,
    NotificationPushDispatchesModule,
    AccessFeatureGrantsQueriesModule,
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
