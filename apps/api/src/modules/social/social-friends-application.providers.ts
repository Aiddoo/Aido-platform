import { Logger, type FactoryProvider } from "@nestjs/common";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import { PaginationService } from "#api/shared/application/pagination/index";
import { MUTATION_LOCK, UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { FOLLOW_CACHE } from "./application/ports/friends/follow-cache.port.js";
import { FOLLOW_NOTIFIER } from "./application/ports/friends/follow-notifier.port.js";
import { FOLLOW_REPOSITORY } from "./application/ports/friends/follow.repository.port.js";
import { FollowReader } from "./application/services/friends/follow.reader.js";
import { FriendshipEffects } from "./application/services/friends/friendship-effects.service.js";
import { AcceptFriendRequest } from "./application/use-cases/friends/accept-friend-request.use-case.js";
import { GetFriendResourceLimit } from "./application/use-cases/friends/get-friend-resource-limit.use-case.js";
import { GetFriends } from "./application/use-cases/friends/get-friends.use-case.js";
import { GetReceivedFriendRequests } from "./application/use-cases/friends/get-received-friend-requests.use-case.js";
import { GetSentFriendRequests } from "./application/use-cases/friends/get-sent-friend-requests.use-case.js";
import { RejectFriendRequest } from "./application/use-cases/friends/reject-friend-request.use-case.js";
import { RemoveFriend } from "./application/use-cases/friends/remove-friend.use-case.js";
import { ReorderFriend } from "./application/use-cases/friends/reorder-friend.use-case.js";
import { SearchUsers } from "./application/use-cases/friends/search-users.use-case.js";
import { SendFriendRequestByTag } from "./application/use-cases/friends/send-friend-request-by-tag.use-case.js";
import { SendFriendRequest } from "./application/use-cases/friends/send-friend-request.use-case.js";

export const followReaderProvider: FactoryProvider<FollowReader> = {
  provide: FollowReader,
  inject: [FOLLOW_REPOSITORY, FOLLOW_CACHE],
  useFactory: (
    followRepository: ConstructorParameters<typeof FollowReader>[0]["followRepository"],
    cache: ConstructorParameters<typeof FollowReader>[0]["cache"],
  ) =>
    new FollowReader({
      followRepository,
      cache,
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

export const sendFriendRequestProvider: FactoryProvider<SendFriendRequest> = {
  provide: SendFriendRequest,
  inject: [
    FOLLOW_REPOSITORY,
    FOLLOW_NOTIFIER,
    UNIT_OF_WORK,
    MUTATION_LOCK,
    ENTITLEMENT_READER,
    FriendshipEffects,
  ],
  useFactory: (
    followRepository: ConstructorParameters<typeof SendFriendRequest>[0]["followRepository"],
    notifier: ConstructorParameters<typeof SendFriendRequest>[0]["notifier"],
    unitOfWork: ConstructorParameters<typeof SendFriendRequest>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof SendFriendRequest>[0]["mutationLock"],
    entitlementReader: ConstructorParameters<typeof SendFriendRequest>[0]["entitlementReader"],
    effects: ConstructorParameters<typeof SendFriendRequest>[0]["effects"],
  ) =>
    new SendFriendRequest({
      followRepository,
      notifier,
      unitOfWork,
      mutationLock,
      entitlementReader,
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

export const acceptFriendRequestProvider: FactoryProvider<AcceptFriendRequest> = {
  provide: AcceptFriendRequest,
  inject: [FOLLOW_REPOSITORY, UNIT_OF_WORK, MUTATION_LOCK, FriendshipEffects],
  useFactory: (
    followRepository: ConstructorParameters<typeof AcceptFriendRequest>[0]["followRepository"],
    unitOfWork: ConstructorParameters<typeof AcceptFriendRequest>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof AcceptFriendRequest>[0]["mutationLock"],
    effects: ConstructorParameters<typeof AcceptFriendRequest>[0]["effects"],
  ) =>
    new AcceptFriendRequest({
      followRepository,
      unitOfWork,
      mutationLock,
      effects,
      logger: new Logger(AcceptFriendRequest.name),
    }),
};

export const rejectFriendRequestProvider: FactoryProvider<RejectFriendRequest> = {
  provide: RejectFriendRequest,
  inject: [FOLLOW_REPOSITORY, UNIT_OF_WORK, MUTATION_LOCK],
  useFactory: (
    followRepository: ConstructorParameters<typeof RejectFriendRequest>[0]["followRepository"],
    unitOfWork: ConstructorParameters<typeof RejectFriendRequest>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof RejectFriendRequest>[0]["mutationLock"],
  ) =>
    new RejectFriendRequest({
      followRepository,
      unitOfWork,
      mutationLock,
      logger: new Logger(RejectFriendRequest.name),
    }),
};

export const removeFriendProvider: FactoryProvider<RemoveFriend> = {
  provide: RemoveFriend,
  inject: [FOLLOW_REPOSITORY, UNIT_OF_WORK, MUTATION_LOCK, FriendshipEffects],
  useFactory: (
    followRepository: ConstructorParameters<typeof RemoveFriend>[0]["followRepository"],
    unitOfWork: ConstructorParameters<typeof RemoveFriend>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof RemoveFriend>[0]["mutationLock"],
    effects: ConstructorParameters<typeof RemoveFriend>[0]["effects"],
  ) =>
    new RemoveFriend({
      followRepository,
      unitOfWork,
      mutationLock,
      effects,
      logger: new Logger(RemoveFriend.name),
    }),
};

export const reorderFriendProvider: FactoryProvider<ReorderFriend> = {
  provide: ReorderFriend,
  inject: [FOLLOW_REPOSITORY, UNIT_OF_WORK, MUTATION_LOCK],
  useFactory: (
    followRepository: ConstructorParameters<typeof ReorderFriend>[0]["followRepository"],
    unitOfWork: ConstructorParameters<typeof ReorderFriend>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof ReorderFriend>[0]["mutationLock"],
  ) =>
    new ReorderFriend({
      followRepository,
      unitOfWork,
      mutationLock,
      logger: new Logger(ReorderFriend.name),
    }),
};

export const getFriendsProvider: FactoryProvider<GetFriends> = {
  provide: GetFriends,
  inject: [FOLLOW_REPOSITORY, PaginationService, FollowReader],
  useFactory: (
    followRepository: ConstructorParameters<typeof GetFriends>[0]["followRepository"],
    paginationService: ConstructorParameters<typeof GetFriends>[0]["paginationService"],
    reader: ConstructorParameters<typeof GetFriends>[0]["reader"],
  ) =>
    new GetFriends({
      followRepository,
      paginationService,
      reader,
    }),
};

export const getReceivedFriendRequestsProvider: FactoryProvider<GetReceivedFriendRequests> = {
  provide: GetReceivedFriendRequests,
  inject: [FOLLOW_REPOSITORY, PaginationService],
  useFactory: (
    followRepository: ConstructorParameters<
      typeof GetReceivedFriendRequests
    >[0]["followRepository"],
    paginationService: ConstructorParameters<
      typeof GetReceivedFriendRequests
    >[0]["paginationService"],
  ) =>
    new GetReceivedFriendRequests({
      followRepository,
      paginationService,
    }),
};

export const getSentFriendRequestsProvider: FactoryProvider<GetSentFriendRequests> = {
  provide: GetSentFriendRequests,
  inject: [FOLLOW_REPOSITORY, PaginationService],
  useFactory: (
    followRepository: ConstructorParameters<typeof GetSentFriendRequests>[0]["followRepository"],
    paginationService: ConstructorParameters<typeof GetSentFriendRequests>[0]["paginationService"],
  ) =>
    new GetSentFriendRequests({
      followRepository,
      paginationService,
    }),
};

export const getFriendResourceLimitProvider: FactoryProvider<GetFriendResourceLimit> = {
  provide: GetFriendResourceLimit,
  inject: [FollowReader, ENTITLEMENT_READER],
  useFactory: (
    reader: ConstructorParameters<typeof GetFriendResourceLimit>[0]["reader"],
    entitlementReader: ConstructorParameters<typeof GetFriendResourceLimit>[0]["entitlementReader"],
  ) =>
    new GetFriendResourceLimit({
      reader,
      entitlementReader,
    }),
};
