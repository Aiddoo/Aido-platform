import { Module } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-entitlement.public";
import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";
import { SocialBlocksModule } from "#api/modules/social/blocks/social-blocks.public";

import { FollowReader } from "./application/follow.reader.js";
import { FollowCachePort } from "./application/ports/follow-cache.port.js";
import { FOLLOW_NOTIFIER } from "./application/ports/follow-notifier.port.js";
import { FOLLOW_READER, FollowReaderPort } from "./application/ports/follow.reader.port.js";
import { FOLLOW_REPOSITORY } from "./application/ports/follow.repository.port.js";
import {
  FRIEND_COUNT_READER,
  FriendCountReaderPort,
} from "./application/ports/friend-count.reader.port.js";
import { FriendshipEstablisherPort } from "./application/ports/friendship-establisher.port.js";
import { EstablishFriendshipUseCase } from "./application/use-cases/establish-friendship.use-case.js";
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
    { provide: FollowCachePort, useClass: FollowCacheAdapter },
    { provide: FOLLOW_NOTIFIER, useClass: FollowNotifierAdapter },
    followReaderProvider,
    { provide: FollowReaderPort, useExisting: FollowReader },
    { provide: FriendCountReaderPort, useExisting: FollowReader },
    { provide: FOLLOW_READER, useExisting: FollowReaderPort },
    { provide: FRIEND_COUNT_READER, useExisting: FriendCountReaderPort },
    friendshipEffectsProvider,
    friendshipEstablisherProvider,
    { provide: FriendshipEstablisherPort, useExisting: EstablishFriendshipUseCase },
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
  exports: [
    FollowReaderPort,
    FriendCountReaderPort,
    FriendshipEstablisherPort,
    FOLLOW_READER,
    FRIEND_COUNT_READER,
  ],
})
export class SocialFriendsModule {}
