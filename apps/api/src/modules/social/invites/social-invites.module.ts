import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AccessEntitlementsModule } from "#api/modules/access/entitlements/access-entitlements.public";
import { BillingSubscriptionsModule } from "#api/modules/billing/subscriptions/billing-subscriptions.public";
import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";
import { SocialBlocksModule } from "#api/modules/social/blocks/social-blocks.public";
import { SocialFriendsModule } from "#api/modules/social/friends/social-friends.public";
import { provideEventSubscriptions } from "#api/platform/events/event-subscription.catalog";

import {
  INVITEE_ACTIVITY_SUBSCRIPTION,
  InviteeActivityEventHandler,
} from "./infrastructure/event-handlers/invitee-activity.event-handler.js";
import { InviteMaintenanceProcessor } from "./infrastructure/jobs/invite-maintenance.processor.js";
import { InviteMaintenanceScheduler } from "./infrastructure/jobs/invite-maintenance.scheduler.js";
import { InviteRewardProcessor } from "./infrastructure/jobs/invite-reward.processor.js";
import { InviteController } from "./presentation/http/v1/invite.controller.js";
import { socialInvitesConfig } from "./social-invites.config.js";
import { SOCIAL_INVITES_PROVIDERS } from "./social-invites.providers.js";

@Module({
  imports: [
    SocialBlocksModule,
    SocialFriendsModule,
    NotificationDeliveryModule,
    AccessEntitlementsModule,
    BillingSubscriptionsModule,
    ConfigModule.forFeature(socialInvitesConfig),
  ],
  controllers: [InviteController],
  providers: [
    ...SOCIAL_INVITES_PROVIDERS,
    provideEventSubscriptions(INVITEE_ACTIVITY_SUBSCRIPTION),
    InviteeActivityEventHandler,
    InviteRewardProcessor,
    InviteMaintenanceScheduler,
    InviteMaintenanceProcessor,
  ],
})
export class SocialInvitesModule {}
