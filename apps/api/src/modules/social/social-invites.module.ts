import { Module } from "@nestjs/common";

import { TypedConfigService } from "#api/platform/config/services/config.service";

import { INVITE_REDEMPTION_REPOSITORY } from "./application/ports/invites/invite-redemption.repository.port.js";
import {
  INVITE_CONFIG,
  type InviteConfigPort,
} from "./application/ports/invites/invite.config.port.js";
import { INVITE_REPOSITORY } from "./application/ports/invites/invite.repository.port.js";
import { REWARD_GRANT_REPOSITORY } from "./application/ports/invites/reward-grant.repository.port.js";
import { InviteCodeGenerator } from "./infrastructure/persistence/invites/invite-code.generator.js";
import { PrismaInviteRedemptionRepository } from "./infrastructure/persistence/invites/prisma-invite-redemption.repository.js";
import { PrismaInviteRepository } from "./infrastructure/persistence/invites/prisma-invite.repository.js";
import { PrismaRewardGrantRepository } from "./infrastructure/persistence/invites/prisma-reward-grant.repository.js";
import { InviteController } from "./presentation/controllers/invites/invite.controller.js";
import {
  getInviteAvailabilityProvider,
  getInvitedFriendsProvider,
  getMyInviteProvider,
  myInviteReaderProvider,
  previewInviteProvider,
  rotateInviteCodeProvider,
} from "./social-invites-application.providers.js";

@Module({
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
    myInviteReaderProvider,
    getInviteAvailabilityProvider,
    getMyInviteProvider,
    rotateInviteCodeProvider,
    previewInviteProvider,
    getInvitedFriendsProvider,
  ],
})
export class SocialInvitesModule {}
