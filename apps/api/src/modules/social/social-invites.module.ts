import { Module } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-entitlement.public";
import { BillingSubscriptionsModule } from "#api/modules/billing/billing-subscriptions.public";
import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";
import { SocialBlocksModule } from "#api/modules/social/social-blocks.public";
import { SocialFriendsModule } from "#api/modules/social/social-friends.public";
import { TypedConfigService } from "#api/platform/config/services/config.service";

import { CLAIM_HASHER } from "./application/ports/invites/claim-hasher.port.js";
import { INVITE_NOTIFIER } from "./application/ports/invites/invite-notifier.port.js";
import { INVITE_REDEMPTION_REPOSITORY } from "./application/ports/invites/invite-redemption.repository.port.js";
import { INVITE_REWARD_ALERT } from "./application/ports/invites/invite-reward-alert.port.js";
import { INVITE_REWARD_SCHEDULER } from "./application/ports/invites/invite-reward.scheduler.port.js";
import {
  INVITE_CONFIG,
  type InviteConfigPort,
} from "./application/ports/invites/invite.config.port.js";
import { INVITE_REPOSITORY } from "./application/ports/invites/invite.repository.port.js";
import { REWARD_CLAIM_REPOSITORY } from "./application/ports/invites/reward-claim.repository.port.js";
import { REWARD_GRANT_REPOSITORY } from "./application/ports/invites/reward-grant.repository.port.js";
import { FriendSlotRewardApplier } from "./infrastructure/adapters/invites/friend-slot-reward.applier.js";
import { HmacClaimHasherAdapter } from "./infrastructure/adapters/invites/hmac-claim-hasher.adapter.js";
import { InviteNotifierAdapter } from "./infrastructure/adapters/invites/invite-notifier.adapter.js";
import { PremiumDaysRewardApplier } from "./infrastructure/adapters/invites/premium-days-reward.applier.js";
import { rewardAppliersProvider } from "./infrastructure/adapters/invites/reward-appliers.registry.js";
import { SentryInviteRewardAlertAdapter } from "./infrastructure/adapters/invites/sentry-invite-reward-alert.adapter.js";
import { InviteMaintenanceJob } from "./infrastructure/jobs/invites/invite-maintenance.job.js";
import { InviteMaintenanceProcessor } from "./infrastructure/jobs/invites/invite-maintenance.processor.js";
import { InviteRewardProcessor } from "./infrastructure/jobs/invites/invite-reward.processor.js";
import { InviteRewardSchedulerAdapter } from "./infrastructure/jobs/invites/invite-reward.scheduler.adapter.js";
import { InviteCodeGenerator } from "./infrastructure/persistence/invites/invite-code.generator.js";
import { PrismaInviteRedemptionRepository } from "./infrastructure/persistence/invites/prisma-invite-redemption.repository.js";
import { PrismaInviteRepository } from "./infrastructure/persistence/invites/prisma-invite.repository.js";
import { PrismaRewardClaimRepository } from "./infrastructure/persistence/invites/prisma-reward-claim.repository.js";
import { PrismaRewardGrantRepository } from "./infrastructure/persistence/invites/prisma-reward-grant.repository.js";
import { InviteeActivitySubscriber } from "./infrastructure/subscribers/invites/invitee-activity.subscriber.js";
import { InviteController } from "./presentation/controllers/invites/invite.controller.js";
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
} from "./social-invites-application.providers.js";

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
        isEnabled: config.get("INVITE_ENABLED"),
      }),
    },
    InviteCodeGenerator,
    { provide: INVITE_REPOSITORY, useClass: PrismaInviteRepository },
    { provide: INVITE_REDEMPTION_REPOSITORY, useClass: PrismaInviteRedemptionRepository },
    { provide: REWARD_GRANT_REPOSITORY, useClass: PrismaRewardGrantRepository },
    { provide: REWARD_CLAIM_REPOSITORY, useClass: PrismaRewardClaimRepository },
    { provide: CLAIM_HASHER, useClass: HmacClaimHasherAdapter },
    { provide: INVITE_NOTIFIER, useClass: InviteNotifierAdapter },
    { provide: INVITE_REWARD_ALERT, useClass: SentryInviteRewardAlertAdapter },
    { provide: INVITE_REWARD_SCHEDULER, useClass: InviteRewardSchedulerAdapter },
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
    InviteeActivitySubscriber,
    InviteRewardProcessor,
    InviteMaintenanceJob,
    InviteMaintenanceProcessor,
  ],
})
export class SocialInvitesModule {}
