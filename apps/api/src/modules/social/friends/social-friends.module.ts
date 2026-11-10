import { Module } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-entitlement.public";
import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";
import { SocialBlocksModule } from "#api/modules/social/blocks/social-blocks.public";

import { FOLLOW_READER, FollowReaderPort } from "./application/ports/follow.reader.port.js";
import {
  FRIEND_COUNT_READER,
  FriendCountReaderPort,
} from "./application/ports/friend-count.reader.port.js";
import { FriendshipEstablisherPort } from "./application/ports/friendship-establisher.port.js";
import { FollowController } from "./presentation/http/v1/follow.controller.js";
import { SOCIAL_FRIENDS_PROVIDERS } from "./social-friends.providers.js";

@Module({
  imports: [AccessModule, NotificationDeliveryModule, SocialBlocksModule],
  controllers: [FollowController],
  providers: [
    ...SOCIAL_FRIENDS_PROVIDERS,
    { provide: FOLLOW_READER, useExisting: FollowReaderPort },
    { provide: FRIEND_COUNT_READER, useExisting: FriendCountReaderPort },
  ],
  exports: [
    FollowReaderPort,
    FriendCountReaderPort,
    FriendshipEstablisherPort,
    FOLLOW_READER,
    FRIEND_COUNT_READER,
  ],
})
export class SocialFriendsModule {}
