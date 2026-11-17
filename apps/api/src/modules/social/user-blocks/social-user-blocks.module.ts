import { Module } from "@nestjs/common";

import { IdentityUserAccessModule } from "#api/modules/identity/users/identity-users.public";
import { SocialCheersModule } from "#api/modules/social/cheers/social-cheers.public";
import { SocialFriendshipsModule } from "#api/modules/social/friendships/social-friendships.public";
import { SocialNudgesModule } from "#api/modules/social/nudges/social-nudges.public";

import { UserBlockController } from "./presentation/http/v1/user-block.controller.js";
import { SOCIAL_USER_BLOCKS_PROVIDERS } from "./social-user-blocks.providers.js";

// 차단은 친구 관계를 끊고 콕·응원 수 캐시를 비워 그 slice들을 import한다. 반대 방향은 차단 조회 Module(social-user-blocks-queries)로 읽는다
@Module({
  imports: [
    IdentityUserAccessModule,
    SocialFriendshipsModule,
    SocialCheersModule,
    SocialNudgesModule,
  ],
  controllers: [UserBlockController],
  providers: [...SOCIAL_USER_BLOCKS_PROVIDERS],
})
export class SocialUserBlocksModule {}
