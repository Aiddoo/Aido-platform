import { Logger, type FactoryProvider } from "@nestjs/common";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import { PaginationService } from "#api/shared/application/pagination/index";
import { UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { FOLLOW_CACHE } from "./application/ports/friends/follow-cache.port.js";
import { FOLLOW_NOTIFIER } from "./application/ports/friends/follow-notifier.port.js";
import { FOLLOW_REPOSITORY } from "./application/ports/friends/follow.repository.port.js";
import { FollowReader } from "./application/services/friends/follow.reader.js";
import { FriendshipEffects } from "./application/services/friends/friendship-effects.service.js";
import { AcceptFriendRequest } from "./application/use-cases/friends/accept-friend-request.use-case.js";
import { RejectFriendRequest } from "./application/use-cases/friends/reject-friend-request.use-case.js";
import { RemoveFriend } from "./application/use-cases/friends/remove-friend.use-case.js";
import { ReorderFriend } from "./application/use-cases/friends/reorder-friend.use-case.js";
import { SearchUsers } from "./application/use-cases/friends/search-users.use-case.js";
import { SendFriendRequestByTag } from "./application/use-cases/friends/send-friend-request-by-tag.use-case.js";
import { SendFriendRequest } from "./application/use-cases/friends/send-friend-request.use-case.js";

export const searchUsersProvider: FactoryProvider<SearchUsers> = {
  provide: SearchUsers,
  inject: [FOLLOW_REPOSITORY, PaginationService],
  useFactory: (
    followRepository: ConstructorParameters<typeof SearchUsers>[0]["followRepository"],
    paginationService: ConstructorParameters<typeof SearchUsers>[0]["paginationService"],
  ) =>
    new SearchUsers({
      followRepository,
      paginationService,
      logger: new Logger(SearchUsers.name),
    }),
};

export const followReaderProvider: FactoryProvider<FollowReader> = {
  provide: FollowReader,
  inject: [FOLLOW_REPOSITORY, FOLLOW_CACHE, PaginationService, ENTITLEMENT_READER],
  useFactory: (
    followRepository: ConstructorParameters<typeof FollowReader>[0]["followRepository"],
    cache: ConstructorParameters<typeof FollowReader>[0]["cache"],
    paginationService: ConstructorParameters<typeof FollowReader>[0]["paginationService"],
    entitlementReader: ConstructorParameters<typeof FollowReader>[0]["entitlementReader"],
  ) =>
    new FollowReader({
      followRepository,
      cache,
      paginationService,
      entitlementReader,
      logger: new Logger(FollowReader.name),
    }),
};

export const friendshipEffectsProvider: FactoryProvider<FriendshipEffects> = {
  provide: FriendshipEffects,
  inject: [FOLLOW_REPOSITORY, FOLLOW_CACHE, FOLLOW_NOTIFIER],
  useFactory: (
    followRepository: ConstructorParameters<typeof FriendshipEffects>[0]["followRepository"],
    cache: ConstructorParameters<typeof FriendshipEffects>[0]["cache"],
    notifier: ConstructorParameters<typeof FriendshipEffects>[0]["notifier"],
  ) =>
    new FriendshipEffects({
      followRepository,
      cache,
      notifier,
      logger: new Logger(FriendshipEffects.name),
    }),
};

export const acceptFriendRequestProvider: FactoryProvider<AcceptFriendRequest> = {
  provide: AcceptFriendRequest,
  inject: [FOLLOW_REPOSITORY, UNIT_OF_WORK, FriendshipEffects],
  useFactory: (
    followRepository: ConstructorParameters<typeof AcceptFriendRequest>[0]["followRepository"],
    unitOfWork: ConstructorParameters<typeof AcceptFriendRequest>[0]["unitOfWork"],
    effects: ConstructorParameters<typeof AcceptFriendRequest>[0]["effects"],
  ) =>
    new AcceptFriendRequest({
      followRepository,
      unitOfWork,
      effects,
      logger: new Logger(AcceptFriendRequest.name),
    }),
};

export const rejectFriendRequestProvider: FactoryProvider<RejectFriendRequest> = {
  provide: RejectFriendRequest,
  inject: [FOLLOW_REPOSITORY],
  useFactory: (
    followRepository: ConstructorParameters<typeof RejectFriendRequest>[0]["followRepository"],
  ) =>
    new RejectFriendRequest({
      followRepository,
      logger: new Logger(RejectFriendRequest.name),
    }),
};

export const removeFriendProvider: FactoryProvider<RemoveFriend> = {
  provide: RemoveFriend,
  inject: [FOLLOW_REPOSITORY, UNIT_OF_WORK, FriendshipEffects],
  useFactory: (
    followRepository: ConstructorParameters<typeof RemoveFriend>[0]["followRepository"],
    unitOfWork: ConstructorParameters<typeof RemoveFriend>[0]["unitOfWork"],
    effects: ConstructorParameters<typeof RemoveFriend>[0]["effects"],
  ) =>
    new RemoveFriend({
      followRepository,
      unitOfWork,
      effects,
      logger: new Logger(RemoveFriend.name),
    }),
};

export const reorderFriendProvider: FactoryProvider<ReorderFriend> = {
  provide: ReorderFriend,
  inject: [FOLLOW_REPOSITORY, UNIT_OF_WORK],
  useFactory: (
    followRepository: ConstructorParameters<typeof ReorderFriend>[0]["followRepository"],
    unitOfWork: ConstructorParameters<typeof ReorderFriend>[0]["unitOfWork"],
  ) =>
    new ReorderFriend({
      followRepository,
      unitOfWork,
      logger: new Logger(ReorderFriend.name),
    }),
};

export const sendFriendRequestProvider: FactoryProvider<SendFriendRequest> = {
  provide: SendFriendRequest,
  inject: [
    FOLLOW_REPOSITORY,
    FOLLOW_NOTIFIER,
    UNIT_OF_WORK,
    ENTITLEMENT_READER,
    FollowReader,
    FriendshipEffects,
  ],
  useFactory: (
    followRepository: ConstructorParameters<typeof SendFriendRequest>[0]["followRepository"],
    notifier: ConstructorParameters<typeof SendFriendRequest>[0]["notifier"],
    unitOfWork: ConstructorParameters<typeof SendFriendRequest>[0]["unitOfWork"],
    entitlementReader: ConstructorParameters<typeof SendFriendRequest>[0]["entitlementReader"],
    reader: ConstructorParameters<typeof SendFriendRequest>[0]["reader"],
    effects: ConstructorParameters<typeof SendFriendRequest>[0]["effects"],
  ) =>
    new SendFriendRequest({
      followRepository,
      notifier,
      unitOfWork,
      entitlementReader,
      reader,
      effects,
      logger: new Logger(SendFriendRequest.name),
    }),
};

export const sendFriendRequestByTagProvider: FactoryProvider<SendFriendRequestByTag> = {
  provide: SendFriendRequestByTag,
  inject: [FOLLOW_REPOSITORY, SendFriendRequest],
  useFactory: (
    followRepository: ConstructorParameters<typeof SendFriendRequestByTag>[0]["followRepository"],
    sendFriendRequest: ConstructorParameters<typeof SendFriendRequestByTag>[0]["sendFriendRequest"],
  ) =>
    new SendFriendRequestByTag({
      followRepository,
      sendFriendRequest,
    }),
};
