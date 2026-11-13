import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { SocialInviteRedemptionQueriesModule } from "#api/modules/social/invite-redemptions/social-invite-redemption-queries.public";

import { InviteConfigPort } from "./application/ports/invite-config.port.js";
import { InviteReaderPort } from "./application/ports/invite.reader.port.js";
import { InviteController } from "./presentation/http/v1/invite.controller.js";
import { socialInvitesConfig } from "./social-invites.config.js";
import { SOCIAL_INVITES_PROVIDERS } from "./social-invites.providers.js";

// 내 초대 요약은 수락 조회 Module에서 읽는다. 수락 slice가 이 Module을 import해 코드로 초대를 찾는다
@Module({
  imports: [SocialInviteRedemptionQueriesModule, ConfigModule.forFeature(socialInvitesConfig)],
  controllers: [InviteController],
  providers: [...SOCIAL_INVITES_PROVIDERS],
  exports: [InviteReaderPort, InviteConfigPort],
})
export class SocialInvitesModule {}
