import { Module } from "@nestjs/common";

import { AccessFeatureGrantsQueriesModule } from "#api/modules/access/feature-grants/access-feature-grants.public";
import { NotificationPushModule } from "#api/modules/notification/notification-delivery.public";
import { SocialBlockQueriesModule } from "#api/modules/social/blocks/social-block-queries.public";

import { FriendshipEstablisherPort } from "./application/ports/friendship-establisher.port.js";
import { FriendshipSeverancePort } from "./application/ports/friendship-severance.port.js";
import { MutualFriendReaderPort } from "./application/ports/mutual-friend.reader.port.js";
import { FollowController } from "./presentation/http/v1/follow.controller.js";
import { SOCIAL_FRIENDS_PROVIDERS } from "./social-friends.providers.js";

@Module({
  imports: [AccessFeatureGrantsQueriesModule, NotificationPushModule, SocialBlockQueriesModule],
  controllers: [FollowController],
  providers: [...SOCIAL_FRIENDS_PROVIDERS],
  exports: [MutualFriendReaderPort, FriendshipEstablisherPort, FriendshipSeverancePort],
})
export class SocialFriendsModule {}
