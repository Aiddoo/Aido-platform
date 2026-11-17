import { Module } from "@nestjs/common";

import { AccessFeatureGrantsQueriesModule } from "#api/modules/access/feature-grants/access-feature-grants.public";
import { IdentityUserAccessModule } from "#api/modules/identity/users/identity-users.public";
import { NotificationPushModule } from "#api/modules/notification/notification-delivery.public";
import { SocialUserBlocksQueriesModule } from "#api/modules/social/user-blocks/social-user-blocks.public";

import { FriendshipEstablisherPort } from "./application/ports/friendship-establisher.port.js";
import { FriendshipSeverancePort } from "./application/ports/friendship-severance.port.js";
import { MutualFriendReaderPort } from "./application/ports/mutual-friend.reader.port.js";
import { FollowController } from "./presentation/http/v1/follow.controller.js";
import { FriendRequestController } from "./presentation/http/v1/friend-request.controller.js";
import { SOCIAL_FRIENDSHIPS_PROVIDERS } from "./social-friendships.providers.js";

@Module({
  imports: [
    AccessFeatureGrantsQueriesModule,
    IdentityUserAccessModule,
    NotificationPushModule,
    SocialUserBlocksQueriesModule,
  ],
  controllers: [FriendRequestController, FollowController],
  providers: [...SOCIAL_FRIENDSHIPS_PROVIDERS],
  exports: [MutualFriendReaderPort, FriendshipEstablisherPort, FriendshipSeverancePort],
})
export class SocialFriendshipsModule {}
