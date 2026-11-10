import { Module } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-entitlement.public";
import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";
import { SocialBlocksModule } from "#api/modules/social/blocks/social-blocks.public";

import { FollowReaderPort } from "./application/ports/follow.reader.port.js";
import { FriendCountReaderPort } from "./application/ports/friend-count.reader.port.js";
import { FriendshipEstablisherPort } from "./application/ports/friendship-establisher.port.js";
import { FollowController } from "./presentation/http/v1/follow.controller.js";
import { SOCIAL_FRIENDS_PROVIDERS } from "./social-friends.providers.js";

@Module({
  imports: [AccessModule, NotificationDeliveryModule, SocialBlocksModule],
  controllers: [FollowController],
  providers: [...SOCIAL_FRIENDS_PROVIDERS],
  exports: [FollowReaderPort, FriendCountReaderPort, FriendshipEstablisherPort],
})
export class SocialFriendsModule {}
