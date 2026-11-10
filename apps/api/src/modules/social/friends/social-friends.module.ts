import { Module } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-entitlement.public";
import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";
import { SocialBlocksModule } from "#api/modules/social/blocks/social-blocks.public";

import { FollowReader } from "./application/follow.reader.js";
import { FOLLOW_CACHE } from "./application/ports/follow-cache.port.js";
import { FOLLOW_NOTIFIER } from "./application/ports/follow-notifier.port.js";
import { FOLLOW_READER } from "./application/ports/follow.reader.port.js";
import { FOLLOW_REPOSITORY } from "./application/ports/follow.repository.port.js";
import { FRIEND_COUNT_READER } from "./application/ports/friend-count.reader.port.js";
import { FRIENDSHIP_ESTABLISHER } from "./application/ports/friendship-establisher.port.js";
import { FriendshipEstablisher } from "./application/use-cases/establish-friendship.use-case.js";
import { FollowCacheAdapter } from "./infrastructure/adapters/follow-cache.adapter.js";
import { FollowNotifierAdapter } from "./infrastructure/adapters/follow-notifier.adapter.js";
import { DrizzleFollowRepository } from "./infrastructure/persistence/drizzle-follow.repository.js";
import { FollowController } from "./presentation/http/v1/follow.controller.js";
import {
  acceptFriendRequestProvider,
  followReaderProvider,
  friendshipEffectsProvider,
  friendshipEstablisherProvider,
  getFriendsProvider,
  getReceivedFriendRequestsProvider,
  getSentFriendRequestsProvider,
  getFriendResourceLimitProvider,
  rejectFriendRequestProvider,
  removeFriendProvider,
  reorderFriendProvider,
  searchUsersProvider,
  sendFriendRequestByTagProvider,
  sendFriendRequestProvider,
} from "./social-friends.providers.js";

@Module({
  imports: [AccessModule, NotificationDeliveryModule, SocialBlocksModule],
  controllers: [FollowController],
  providers: [
    { provide: FOLLOW_REPOSITORY, useClass: DrizzleFollowRepository },
    { provide: FOLLOW_CACHE, useClass: FollowCacheAdapter },
    { provide: FOLLOW_NOTIFIER, useClass: FollowNotifierAdapter },
    followReaderProvider,
    { provide: FOLLOW_READER, useExisting: FollowReader },
    { provide: FRIEND_COUNT_READER, useExisting: FollowReader },
    friendshipEffectsProvider,
    friendshipEstablisherProvider,
    { provide: FRIENDSHIP_ESTABLISHER, useExisting: FriendshipEstablisher },
    getFriendsProvider,
    getReceivedFriendRequestsProvider,
    getSentFriendRequestsProvider,
    getFriendResourceLimitProvider,

    sendFriendRequestProvider,
    sendFriendRequestByTagProvider,
    acceptFriendRequestProvider,
    rejectFriendRequestProvider,
    removeFriendProvider,
    reorderFriendProvider,
    searchUsersProvider,
  ],
  exports: [FOLLOW_READER, FRIEND_COUNT_READER, FRIENDSHIP_ESTABLISHER],
})
export class SocialFriendsModule {}
