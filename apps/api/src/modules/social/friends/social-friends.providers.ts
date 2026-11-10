import { Logger, type FactoryProvider } from "@nestjs/common";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import { PaginationService } from "#api/shared/application/pagination/index";
import {
  AFTER_COMMIT_TASK_REGISTRY,
  MUTATION_LOCK,
  UNIT_OF_WORK,
} from "#api/shared/application/ports/index";

import { USER_BLOCK_READER } from "../blocks/application/ports/user-block.reader.port.js";
import { FollowReader } from "./application/follow.reader.js";
import { FollowCachePort } from "./application/ports/follow-cache.port.js";
import { FOLLOW_NOTIFIER } from "./application/ports/follow-notifier.port.js";
import { FOLLOW_REPOSITORY } from "./application/ports/follow.repository.port.js";
import { AcceptFriendRequestUseCase } from "./application/use-cases/accept-friend-request.use-case.js";
import { EstablishFriendshipUseCase } from "./application/use-cases/establish-friendship.use-case.js";
import { FriendshipEffects } from "./application/use-cases/friendship-effects.use-case.js";
import { GetFriendResourceLimitUseCase } from "./application/use-cases/get-friend-resource-limit.use-case.js";
import { GetFriendsUseCase } from "./application/use-cases/get-friends.use-case.js";
import { GetReceivedFriendRequestsUseCase } from "./application/use-cases/get-received-friend-requests.use-case.js";
import { GetSentFriendRequestsUseCase } from "./application/use-cases/get-sent-friend-requests.use-case.js";
import { RejectFriendRequestUseCase } from "./application/use-cases/reject-friend-request.use-case.js";
import { RemoveFriendUseCase } from "./application/use-cases/remove-friend.use-case.js";
import { ReorderFriendUseCase } from "./application/use-cases/reorder-friend.use-case.js";
import { SearchUsersUseCase } from "./application/use-cases/search-users.use-case.js";
import { SendFriendRequestByTagUseCase } from "./application/use-cases/send-friend-request-by-tag.use-case.js";
import { SendFriendRequestUseCase } from "./application/use-cases/send-friend-request.use-case.js";

export const followReaderProvider: FactoryProvider<FollowReader> = {
  provide: FollowReader,
  inject: [FOLLOW_REPOSITORY, FollowCachePort],
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
  inject: [FOLLOW_REPOSITORY, FollowCachePort, FOLLOW_NOTIFIER],
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

export const friendshipEstablisherProvider: FactoryProvider<EstablishFriendshipUseCase> = {
  provide: EstablishFriendshipUseCase,
  inject: [
    FOLLOW_REPOSITORY,
    ENTITLEMENT_READER,
    FOLLOW_NOTIFIER,
    FriendshipEffects,
    MUTATION_LOCK,
    UNIT_OF_WORK,
    AFTER_COMMIT_TASK_REGISTRY,
  ],
  useFactory: (
    followRepository: ConstructorParameters<
      typeof EstablishFriendshipUseCase
    >[0]["followRepository"],
    entitlementReader: ConstructorParameters<
      typeof EstablishFriendshipUseCase
    >[0]["entitlementReader"],
    notifier: ConstructorParameters<typeof EstablishFriendshipUseCase>[0]["notifier"],
    effects: ConstructorParameters<typeof EstablishFriendshipUseCase>[0]["effects"],
    mutationLock: ConstructorParameters<typeof EstablishFriendshipUseCase>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof EstablishFriendshipUseCase>[0]["unitOfWork"],
    afterCommitTasks: ConstructorParameters<
      typeof EstablishFriendshipUseCase
    >[0]["afterCommitTasks"],
  ) =>
    new EstablishFriendshipUseCase({
      followRepository,
      entitlementReader,
      notifier,
      effects,
      mutationLock,
      unitOfWork,
      afterCommitTasks,
      logger: new Logger(EstablishFriendshipUseCase.name),
    }),
};

export const searchUsersProvider: FactoryProvider<SearchUsersUseCase> = {
  provide: SearchUsersUseCase,
  inject: [FOLLOW_REPOSITORY, PaginationService],
  useFactory: (
    followRepository: ConstructorParameters<typeof SearchUsersUseCase>[0]["followRepository"],
    paginationService: ConstructorParameters<typeof SearchUsersUseCase>[0]["paginationService"],
  ) =>
    new SearchUsersUseCase({
      followRepository,
      paginationService,
      logger: new Logger(SearchUsersUseCase.name),
    }),
};

export const sendFriendRequestProvider: FactoryProvider<SendFriendRequestUseCase> = {
  provide: SendFriendRequestUseCase,
  inject: [
    FOLLOW_REPOSITORY,
    FOLLOW_NOTIFIER,
    UNIT_OF_WORK,
    MUTATION_LOCK,
    ENTITLEMENT_READER,
    USER_BLOCK_READER,
    FriendshipEffects,
  ],
  useFactory: (
    followRepository: ConstructorParameters<typeof SendFriendRequestUseCase>[0]["followRepository"],
    notifier: ConstructorParameters<typeof SendFriendRequestUseCase>[0]["notifier"],
    unitOfWork: ConstructorParameters<typeof SendFriendRequestUseCase>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof SendFriendRequestUseCase>[0]["mutationLock"],
    entitlementReader: ConstructorParameters<
      typeof SendFriendRequestUseCase
    >[0]["entitlementReader"],
    blockReader: ConstructorParameters<typeof SendFriendRequestUseCase>[0]["blockReader"],
    effects: ConstructorParameters<typeof SendFriendRequestUseCase>[0]["effects"],
  ) =>
    new SendFriendRequestUseCase({
      followRepository,
      notifier,
      unitOfWork,
      mutationLock,
      entitlementReader,
      blockReader,
      effects,
      logger: new Logger(SendFriendRequestUseCase.name),
    }),
};

export const sendFriendRequestByTagProvider: FactoryProvider<SendFriendRequestByTagUseCase> = {
  provide: SendFriendRequestByTagUseCase,
  inject: [FOLLOW_REPOSITORY, SendFriendRequestUseCase],
  useFactory: (
    followRepository: ConstructorParameters<
      typeof SendFriendRequestByTagUseCase
    >[0]["followRepository"],
    sendFriendRequest: ConstructorParameters<
      typeof SendFriendRequestByTagUseCase
    >[0]["sendFriendRequest"],
  ) =>
    new SendFriendRequestByTagUseCase({
      followRepository,
      sendFriendRequest,
    }),
};

export const acceptFriendRequestProvider: FactoryProvider<AcceptFriendRequestUseCase> = {
  provide: AcceptFriendRequestUseCase,
  inject: [FOLLOW_REPOSITORY, UNIT_OF_WORK, MUTATION_LOCK, FriendshipEffects],
  useFactory: (
    followRepository: ConstructorParameters<
      typeof AcceptFriendRequestUseCase
    >[0]["followRepository"],
    unitOfWork: ConstructorParameters<typeof AcceptFriendRequestUseCase>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof AcceptFriendRequestUseCase>[0]["mutationLock"],
    effects: ConstructorParameters<typeof AcceptFriendRequestUseCase>[0]["effects"],
  ) =>
    new AcceptFriendRequestUseCase({
      followRepository,
      unitOfWork,
      mutationLock,
      effects,
      logger: new Logger(AcceptFriendRequestUseCase.name),
    }),
};

export const rejectFriendRequestProvider: FactoryProvider<RejectFriendRequestUseCase> = {
  provide: RejectFriendRequestUseCase,
  inject: [FOLLOW_REPOSITORY, UNIT_OF_WORK, MUTATION_LOCK],
  useFactory: (
    followRepository: ConstructorParameters<
      typeof RejectFriendRequestUseCase
    >[0]["followRepository"],
    unitOfWork: ConstructorParameters<typeof RejectFriendRequestUseCase>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof RejectFriendRequestUseCase>[0]["mutationLock"],
  ) =>
    new RejectFriendRequestUseCase({
      followRepository,
      unitOfWork,
      mutationLock,
      logger: new Logger(RejectFriendRequestUseCase.name),
    }),
};

export const removeFriendProvider: FactoryProvider<RemoveFriendUseCase> = {
  provide: RemoveFriendUseCase,
  inject: [FOLLOW_REPOSITORY, UNIT_OF_WORK, MUTATION_LOCK, FriendshipEffects],
  useFactory: (
    followRepository: ConstructorParameters<typeof RemoveFriendUseCase>[0]["followRepository"],
    unitOfWork: ConstructorParameters<typeof RemoveFriendUseCase>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof RemoveFriendUseCase>[0]["mutationLock"],
    effects: ConstructorParameters<typeof RemoveFriendUseCase>[0]["effects"],
  ) =>
    new RemoveFriendUseCase({
      followRepository,
      unitOfWork,
      mutationLock,
      effects,
      logger: new Logger(RemoveFriendUseCase.name),
    }),
};

export const reorderFriendProvider: FactoryProvider<ReorderFriendUseCase> = {
  provide: ReorderFriendUseCase,
  inject: [FOLLOW_REPOSITORY, UNIT_OF_WORK, MUTATION_LOCK],
  useFactory: (
    followRepository: ConstructorParameters<typeof ReorderFriendUseCase>[0]["followRepository"],
    unitOfWork: ConstructorParameters<typeof ReorderFriendUseCase>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof ReorderFriendUseCase>[0]["mutationLock"],
  ) =>
    new ReorderFriendUseCase({
      followRepository,
      unitOfWork,
      mutationLock,
      logger: new Logger(ReorderFriendUseCase.name),
    }),
};

export const getFriendsProvider: FactoryProvider<GetFriendsUseCase> = {
  provide: GetFriendsUseCase,
  inject: [FOLLOW_REPOSITORY, PaginationService, FollowReader],
  useFactory: (
    followRepository: ConstructorParameters<typeof GetFriendsUseCase>[0]["followRepository"],
    paginationService: ConstructorParameters<typeof GetFriendsUseCase>[0]["paginationService"],
    reader: ConstructorParameters<typeof GetFriendsUseCase>[0]["reader"],
  ) =>
    new GetFriendsUseCase({
      followRepository,
      paginationService,
      reader,
    }),
};

export const getReceivedFriendRequestsProvider: FactoryProvider<GetReceivedFriendRequestsUseCase> =
  {
    provide: GetReceivedFriendRequestsUseCase,
    inject: [FOLLOW_REPOSITORY, PaginationService],
    useFactory: (
      followRepository: ConstructorParameters<
        typeof GetReceivedFriendRequestsUseCase
      >[0]["followRepository"],
      paginationService: ConstructorParameters<
        typeof GetReceivedFriendRequestsUseCase
      >[0]["paginationService"],
    ) =>
      new GetReceivedFriendRequestsUseCase({
        followRepository,
        paginationService,
      }),
  };

export const getSentFriendRequestsProvider: FactoryProvider<GetSentFriendRequestsUseCase> = {
  provide: GetSentFriendRequestsUseCase,
  inject: [FOLLOW_REPOSITORY, PaginationService],
  useFactory: (
    followRepository: ConstructorParameters<
      typeof GetSentFriendRequestsUseCase
    >[0]["followRepository"],
    paginationService: ConstructorParameters<
      typeof GetSentFriendRequestsUseCase
    >[0]["paginationService"],
  ) =>
    new GetSentFriendRequestsUseCase({
      followRepository,
      paginationService,
    }),
};

export const getFriendResourceLimitProvider: FactoryProvider<GetFriendResourceLimitUseCase> = {
  provide: GetFriendResourceLimitUseCase,
  inject: [FollowReader, ENTITLEMENT_READER],
  useFactory: (
    reader: ConstructorParameters<typeof GetFriendResourceLimitUseCase>[0]["reader"],
    entitlementReader: ConstructorParameters<
      typeof GetFriendResourceLimitUseCase
    >[0]["entitlementReader"],
  ) =>
    new GetFriendResourceLimitUseCase({
      reader,
      entitlementReader,
    }),
};
