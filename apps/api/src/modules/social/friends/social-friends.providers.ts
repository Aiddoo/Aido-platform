import type { Provider } from "@nestjs/common";

import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { UserBlockReaderPort } from "../blocks/social-blocks.public.js";
import { FollowCachePort } from "./application/ports/follow-cache.port.js";
import { FollowNotifierPort } from "./application/ports/follow-notifier.port.js";
import { FollowReaderPort } from "./application/ports/follow.reader.port.js";
import { FollowRepositoryPort } from "./application/ports/follow.repository.port.js";
import { FriendCountReaderPort } from "./application/ports/friend-count.reader.port.js";
import { FriendLimitReaderPort } from "./application/ports/friend-limit.reader.port.js";
import { FriendProfileReaderPort } from "./application/ports/friend-profile.reader.port.js";
import { FriendSearchReaderPort } from "./application/ports/friend-search.reader.port.js";
import { FriendshipEstablisherPort } from "./application/ports/friendship-establisher.port.js";
import { FriendshipReaderPort } from "./application/ports/friendship.reader.port.js";
import { AcceptFriendRequestUseCase } from "./application/use-cases/accept-friend-request.use-case.js";
import { CheckFirstFriendMilestoneUseCase } from "./application/use-cases/check-first-friend-milestone.use-case.js";
import { EstablishFriendshipUseCase } from "./application/use-cases/establish-friendship.use-case.js";
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
import { FollowCacheAdapter } from "./infrastructure/adapters/follow-cache.adapter.js";
import { FollowNotifierAdapter } from "./infrastructure/adapters/follow-notifier.adapter.js";
import { FollowReaderAdapter } from "./infrastructure/adapters/follow-reader.adapter.js";
import { FriendLimitReaderAdapter } from "./infrastructure/adapters/friend-limit-reader.adapter.js";
import { FriendshipEstablisherAdapter } from "./infrastructure/adapters/friendship-establisher.adapter.js";
import { DrizzleFollowRepository } from "./infrastructure/persistence/drizzle-follow.repository.js";
import { DrizzleFriendProfileReader } from "./infrastructure/persistence/drizzle-friend-profile.reader.js";
import { DrizzleFriendSearchReader } from "./infrastructure/persistence/drizzle-friend-search.reader.js";
import { DrizzleFriendshipReader } from "./infrastructure/persistence/drizzle-friendship.reader.js";

export const SOCIAL_FRIENDS_PROVIDERS = [
  { provide: FollowRepositoryPort, useClass: DrizzleFollowRepository },
  { provide: FriendshipReaderPort, useClass: DrizzleFriendshipReader },
  { provide: FriendProfileReaderPort, useClass: DrizzleFriendProfileReader },
  { provide: FriendSearchReaderPort, useClass: DrizzleFriendSearchReader },
  { provide: FriendLimitReaderPort, useClass: FriendLimitReaderAdapter },
  { provide: FollowNotifierPort, useClass: FollowNotifierAdapter },
  { provide: FollowCachePort, useClass: FollowCacheAdapter },
  FollowReaderAdapter,
  { provide: FollowReaderPort, useExisting: FollowReaderAdapter },
  { provide: FriendCountReaderPort, useExisting: FollowReaderAdapter },
  { provide: FriendshipEstablisherPort, useClass: FriendshipEstablisherAdapter },
  provideUseCase(CheckFirstFriendMilestoneUseCase, {
    followRepository: FollowRepositoryPort,
    notifier: FollowNotifierPort,
    logger: loggerFor(CheckFirstFriendMilestoneUseCase),
  }),
  provideUseCase(SendFriendRequestUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    followRepository: FollowRepositoryPort,
    profileReader: FriendProfileReaderPort,
    limitReader: FriendLimitReaderPort,
    blockReader: UserBlockReaderPort,
    cache: FollowCachePort,
    notifier: FollowNotifierPort,
    checkFirstFriendMilestone: CheckFirstFriendMilestoneUseCase,
    clock: ClockPort,
    logger: loggerFor(SendFriendRequestUseCase),
  }),
  provideUseCase(SendFriendRequestByTagUseCase, {
    profileReader: FriendProfileReaderPort,
    sendFriendRequest: SendFriendRequestUseCase,
  }),
  provideUseCase(AcceptFriendRequestUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    followRepository: FollowRepositoryPort,
    friendshipReader: FriendshipReaderPort,
    profileReader: FriendProfileReaderPort,
    cache: FollowCachePort,
    notifier: FollowNotifierPort,
    checkFirstFriendMilestone: CheckFirstFriendMilestoneUseCase,
    clock: ClockPort,
    logger: loggerFor(AcceptFriendRequestUseCase),
  }),
  provideUseCase(RejectFriendRequestUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    followRepository: FollowRepositoryPort,
    logger: loggerFor(RejectFriendRequestUseCase),
  }),
  provideUseCase(RemoveFriendUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    followRepository: FollowRepositoryPort,
    cache: FollowCachePort,
    logger: loggerFor(RemoveFriendUseCase),
  }),
  provideUseCase(ReorderFriendUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    followRepository: FollowRepositoryPort,
    friendshipReader: FriendshipReaderPort,
    clock: ClockPort,
    logger: loggerFor(ReorderFriendUseCase),
  }),
  provideUseCase(EstablishFriendshipUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    afterCommit: AfterCommitTaskRegistryPort,
    followRepository: FollowRepositoryPort,
    profileReader: FriendProfileReaderPort,
    limitReader: FriendLimitReaderPort,
    cache: FollowCachePort,
    notifier: FollowNotifierPort,
    checkFirstFriendMilestone: CheckFirstFriendMilestoneUseCase,
    clock: ClockPort,
    logger: loggerFor(EstablishFriendshipUseCase),
  }),
  provideUseCase(GetFriendsUseCase, {
    friendshipReader: FriendshipReaderPort,
    followReader: FollowReaderPort,
  }),
  provideUseCase(GetReceivedFriendRequestsUseCase, { friendshipReader: FriendshipReaderPort }),
  provideUseCase(GetSentFriendRequestsUseCase, { friendshipReader: FriendshipReaderPort }),
  provideUseCase(SearchUsersUseCase, {
    searchReader: FriendSearchReaderPort,
    logger: loggerFor(SearchUsersUseCase),
  }),
  provideUseCase(GetFriendResourceLimitUseCase, {
    followReader: FollowReaderPort,
    limitReader: FriendLimitReaderPort,
  }),
] satisfies Provider[];
