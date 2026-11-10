import { Module } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-entitlement.public";
import { BillingSubscriptionsModule } from "#api/modules/billing/subscriptions/billing-subscriptions.public";
import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";
import { SocialBlocksModule } from "#api/modules/social/blocks/social-blocks.public";
import { SocialFriendsModule } from "#api/modules/social/friends/social-friends.public";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { provideEventSubscriptions } from "#api/platform/events/event-subscription.catalog";

import { CLAIM_HASHER } from "./application/ports/claim-hasher.port.js";
import { INVITE_CONFIG, type InviteConfigPort } from "./application/ports/invite-config.port.js";
import { INVITE_NOTIFIER } from "./application/ports/invite-notifier.port.js";
import { INVITE_QUALIFY_REMINDER_SCHEDULER } from "./application/ports/invite-qualify-reminder-scheduler.port.js";
import { INVITE_REDEMPTION_REPOSITORY } from "./application/ports/invite-redemption.repository.port.js";
import { INVITE_REWARD_SCHEDULER } from "./application/ports/invite-reward-scheduler.port.js";
import { INVITE_REPOSITORY } from "./application/ports/invite.repository.port.js";
import { REWARD_CLAIM_REPOSITORY } from "./application/ports/reward-claim.repository.port.js";
import { REWARD_GRANT_REPOSITORY } from "./application/ports/reward-grant.repository.port.js";
import { FriendSlotRewardApplier } from "./infrastructure/adapters/friend-slot-reward-applier.adapter.js";
import { HmacClaimHasherAdapter } from "./infrastructure/adapters/hmac-claim-hasher.adapter.js";
import { InviteCodeGenerator } from "./infrastructure/adapters/invite-code-generator.adapter.js";
import { InviteNotifierAdapter } from "./infrastructure/adapters/invite-notifier.adapter.js";
import { PremiumDaysRewardApplier } from "./infrastructure/adapters/premium-days-reward-applier.adapter.js";
import { rewardAppliersProvider } from "./infrastructure/adapters/reward-appliers-registry.adapter.js";
import {
  INVITEE_ACTIVITY_SUBSCRIPTION,
  InviteeActivityEventHandler,
} from "./infrastructure/event-handlers/invitee-activity.event-handler.js";
import { InviteMaintenanceProcessor } from "./infrastructure/jobs/invite-maintenance.processor.js";
import { InviteMaintenanceJob } from "./infrastructure/jobs/invite-maintenance.scheduler.js";
import { InviteQualifyReminderSchedulerAdapter } from "./infrastructure/jobs/invite-qualify-reminder-scheduler.adapter.js";
import { InviteRewardSchedulerAdapter } from "./infrastructure/jobs/invite-reward-scheduler.adapter.js";
import { InviteRewardProcessor } from "./infrastructure/jobs/invite-reward.processor.js";
import { DrizzleInviteRedemptionRepository } from "./infrastructure/persistence/drizzle-invite-redemption.repository.js";
import { DrizzleInviteRepository } from "./infrastructure/persistence/drizzle-invite.repository.js";
import { DrizzleRewardClaimRepository } from "./infrastructure/persistence/drizzle-reward-claim.repository.js";
import { DrizzleRewardGrantRepository } from "./infrastructure/persistence/drizzle-reward-grant.repository.js";
import { InviteController } from "./presentation/http/v1/invite.controller.js";
import {
  expireStaleRedemptionsProvider,
  getInviteAvailabilityProvider,
  getInvitedFriendsProvider,
  getMyInviteProvider,
  grantInviteRewardsProvider,
  myInviteReaderProvider,
  previewInviteProvider,
  recordInviteeActivityProvider,
  redeemInviteProvider,
  rotateInviteCodeProvider,
  scheduleInviteQualifyRemindersProvider,
  sendInviteQualifyReminderProvider,
} from "./social-invites.providers.js";

@Module({
  imports: [
    SocialBlocksModule,
    SocialFriendsModule,
    NotificationDeliveryModule,
    AccessModule,
    BillingSubscriptionsModule,
  ],
  controllers: [InviteController],
  providers: [
    {
      provide: INVITE_CONFIG,
      inject: [TypedConfigService],
      useFactory: (config: TypedConfigService): InviteConfigPort => ({
        isEnabled: config.invite.enabled,
      }),
    },
    InviteCodeGenerator,
    { provide: INVITE_REPOSITORY, useClass: DrizzleInviteRepository },
    { provide: INVITE_REDEMPTION_REPOSITORY, useClass: DrizzleInviteRedemptionRepository },
    { provide: REWARD_GRANT_REPOSITORY, useClass: DrizzleRewardGrantRepository },
    { provide: REWARD_CLAIM_REPOSITORY, useClass: DrizzleRewardClaimRepository },
    { provide: CLAIM_HASHER, useClass: HmacClaimHasherAdapter },
    { provide: INVITE_NOTIFIER, useClass: InviteNotifierAdapter },
    { provide: INVITE_REWARD_SCHEDULER, useClass: InviteRewardSchedulerAdapter },
    { provide: INVITE_QUALIFY_REMINDER_SCHEDULER, useClass: InviteQualifyReminderSchedulerAdapter },
    PremiumDaysRewardApplier,
    FriendSlotRewardApplier,
    rewardAppliersProvider,
    myInviteReaderProvider,
    getInviteAvailabilityProvider,
    getMyInviteProvider,
    rotateInviteCodeProvider,
    previewInviteProvider,
    getInvitedFriendsProvider,
    redeemInviteProvider,
    recordInviteeActivityProvider,
    grantInviteRewardsProvider,
    expireStaleRedemptionsProvider,
    scheduleInviteQualifyRemindersProvider,
    sendInviteQualifyReminderProvider,
    provideEventSubscriptions(INVITEE_ACTIVITY_SUBSCRIPTION),
    InviteeActivityEventHandler,
    InviteRewardProcessor,
    InviteMaintenanceJob,
    InviteMaintenanceProcessor,
  ],
})
export class SocialInvitesModule {}
