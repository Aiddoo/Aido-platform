import { Module } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-entitlement.public";
import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";

import { FOLLOW_CACHE } from "./application/ports/friends/follow-cache.port.js";
import { FOLLOW_NOTIFIER } from "./application/ports/friends/follow-notifier.port.js";
import { FOLLOW_READER } from "./application/ports/friends/follow-reader.port.js";
import { FOLLOW_REPOSITORY } from "./application/ports/friends/follow.repository.port.js";
import { FRIENDSHIP_ESTABLISHER } from "./application/ports/friends/friendship-establisher.port.js";
import { FollowReader } from "./application/services/friends/follow.reader.js";
import { FriendshipEstablisher } from "./application/services/friends/friendship-establisher.service.js";
import { FollowCacheAdapter } from "./infrastructure/adapters/friends/follow-cache.adapter.js";
import { FollowNotifierAdapter } from "./infrastructure/adapters/friends/follow-notifier.adapter.js";
import { PrismaFollowRepository } from "./infrastructure/persistence/friends/prisma-follow.repository.js";
import { FollowController } from "./presentation/controllers/friends/follow.controller.js";
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
} from "./social-friends-application.providers.js";

@Module({
  imports: [AccessModule, NotificationDeliveryModule],
  controllers: [FollowController],
  providers: [
    { provide: FOLLOW_REPOSITORY, useClass: PrismaFollowRepository },
    { provide: FOLLOW_CACHE, useClass: FollowCacheAdapter },
    { provide: FOLLOW_NOTIFIER, useClass: FollowNotifierAdapter },
    followReaderProvider,
    { provide: FOLLOW_READER, useExisting: FollowReader },
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
  exports: [FOLLOW_READER, FRIENDSHIP_ESTABLISHER],
})
export class SocialFriendsModule {}
