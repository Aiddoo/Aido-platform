import { Module } from "@nestjs/common";

import { BillingSubscriptionsModule } from "#api/modules/billing/billing-subscriptions.public";
import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";
import { SocialFriendsModule } from "#api/modules/social/social-friends.public";
import { TypedConfigService } from "#api/platform/config/services/config.service";

import { CLAIM_HASHER } from "./application/ports/invites/claim-hasher.port.js";
import { INVITE_NOTIFIER } from "./application/ports/invites/invite-notifier.port.js";
import { INVITE_REDEMPTION_REPOSITORY } from "./application/ports/invites/invite-redemption.repository.port.js";
import {
  INVITE_CONFIG,
  type InviteConfigPort,
} from "./application/ports/invites/invite.config.port.js";
import { INVITE_REPOSITORY } from "./application/ports/invites/invite.repository.port.js";
import { REWARD_CLAIM_REPOSITORY } from "./application/ports/invites/reward-claim.repository.port.js";
import { REWARD_GRANT_REPOSITORY } from "./application/ports/invites/reward-grant.repository.port.js";
import { HmacClaimHasherAdapter } from "./infrastructure/adapters/invites/hmac-claim-hasher.adapter.js";
import { InviteNotifierAdapter } from "./infrastructure/adapters/invites/invite-notifier.adapter.js";
import { InviteCodeGenerator } from "./infrastructure/persistence/invites/invite-code.generator.js";
import { PrismaInviteRedemptionRepository } from "./infrastructure/persistence/invites/prisma-invite-redemption.repository.js";
import { PrismaInviteRepository } from "./infrastructure/persistence/invites/prisma-invite.repository.js";
import { PrismaRewardClaimRepository } from "./infrastructure/persistence/invites/prisma-reward-claim.repository.js";
import { PrismaRewardGrantRepository } from "./infrastructure/persistence/invites/prisma-reward-grant.repository.js";
import { InviteController } from "./presentation/controllers/invites/invite.controller.js";
import {
  getInviteAvailabilityProvider,
  getInvitedFriendsProvider,
  getMyInviteProvider,
  myInviteReaderProvider,
  previewInviteProvider,
  redeemInviteProvider,
  rotateInviteCodeProvider,
} from "./social-invites-application.providers.js";

@Module({
  imports: [SocialFriendsModule, NotificationDeliveryModule, BillingSubscriptionsModule],
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
    myInviteReaderProvider,
    getInviteAvailabilityProvider,
    getMyInviteProvider,
    rotateInviteCodeProvider,
    previewInviteProvider,
    getInvitedFriendsProvider,
    redeemInviteProvider,
  ],
})
export class SocialInvitesModule {}
