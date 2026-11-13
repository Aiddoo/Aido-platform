import type { Provider } from "@nestjs/common";

import { UserBlockReaderPort } from "#api/modules/social/blocks/social-block-queries.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { FriendLimitReaderPort } from "./application/ports/friend-limit.reader.port.js";
import { FriendProfileReaderPort } from "./application/ports/friend-profile.reader.port.js";
import { FriendSearchReaderPort } from "./application/ports/friend-search.reader.port.js";
import { FriendReaderPort } from "./application/ports/friend.reader.port.js";
import { FriendshipCachePort } from "./application/ports/friendship-cache.port.js";
import { FriendshipEstablisherPort } from "./application/ports/friendship-establisher.port.js";
import { FriendshipNotifierPort } from "./application/ports/friendship-notifier.port.js";
import { FriendshipSeverancePort } from "./application/ports/friendship-severance.port.js";
import { FriendshipRepositoryPort } from "./application/ports/friendship.repository.port.js";
import { MutualFriendReaderPort } from "./application/ports/mutual-friend.reader.port.js";
import { AcceptFriendRequestUseCase } from "./application/use-cases/accept-friend-request.use-case.js";
import { EstablishFriendshipUseCase } from "./application/use-cases/establish-friendship.use-case.js";
import { GetFriendResourceLimitUseCase } from "./application/use-cases/get-friend-resource-limit.use-case.js";
import { GetFriendsUseCase } from "./application/use-cases/get-friends.use-case.js";
import { GetReceivedFriendRequestsUseCase } from "./application/use-cases/get-received-friend-requests.use-case.js";
import { GetSentFriendRequestsUseCase } from "./application/use-cases/get-sent-friend-requests.use-case.js";
import { NotifyFirstFriendMilestoneUseCase } from "./application/use-cases/notify-first-friend-milestone.use-case.js";
import { RejectFriendRequestUseCase } from "./application/use-cases/reject-friend-request.use-case.js";
import { RemoveFriendUseCase } from "./application/use-cases/remove-friend.use-case.js";
import { ReorderFriendUseCase } from "./application/use-cases/reorder-friend.use-case.js";
import { SearchUsersUseCase } from "./application/use-cases/search-users.use-case.js";
import { SendFriendRequestByTagUseCase } from "./application/use-cases/send-friend-request-by-tag.use-case.js";
import { SendFriendRequestUseCase } from "./application/use-cases/send-friend-request.use-case.js";
import { SeverFriendshipUseCase } from "./application/use-cases/sever-friendship.use-case.js";
import { FriendLimitReaderAdapter } from "./infrastructure/adapters/friend-limit-reader.adapter.js";
import { FriendshipCacheAdapter } from "./infrastructure/adapters/friendship-cache.adapter.js";
import { FriendshipEstablisherAdapter } from "./infrastructure/adapters/friendship-establisher.adapter.js";
import { FriendshipNotifierAdapter } from "./infrastructure/adapters/friendship-notifier.adapter.js";
import { FriendshipSeveranceAdapter } from "./infrastructure/adapters/friendship-severance.adapter.js";
import { MutualFriendReaderAdapter } from "./infrastructure/adapters/mutual-friend-reader.adapter.js";
import { DrizzleFriendProfileReader } from "./infrastructure/persistence/drizzle-friend-profile.reader.js";
import { DrizzleFriendSearchReader } from "./infrastructure/persistence/drizzle-friend-search.reader.js";
import { DrizzleFriendReader } from "./infrastructure/persistence/drizzle-friend.reader.js";
import { DrizzleFriendshipRepository } from "./infrastructure/persistence/drizzle-friendship.repository.js";

export const SOCIAL_FRIENDS_PROVIDERS = [
  { provide: FriendshipRepositoryPort, useClass: DrizzleFriendshipRepository },
  { provide: FriendReaderPort, useClass: DrizzleFriendReader },
  { provide: FriendProfileReaderPort, useClass: DrizzleFriendProfileReader },
  { provide: FriendSearchReaderPort, useClass: DrizzleFriendSearchReader },
  { provide: FriendLimitReaderPort, useClass: FriendLimitReaderAdapter },
  { provide: FriendshipNotifierPort, useClass: FriendshipNotifierAdapter },
  { provide: FriendshipCachePort, useClass: FriendshipCacheAdapter },
  { provide: MutualFriendReaderPort, useClass: MutualFriendReaderAdapter },
  { provide: FriendshipEstablisherPort, useClass: FriendshipEstablisherAdapter },
  { provide: FriendshipSeverancePort, useClass: FriendshipSeveranceAdapter },
  provideUseCase(NotifyFirstFriendMilestoneUseCase, {
    friendshipRepository: FriendshipRepositoryPort,
    notifier: FriendshipNotifierPort,
  }),
  provideUseCase(SendFriendRequestUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    friendshipRepository: FriendshipRepositoryPort,
    profileReader: FriendProfileReaderPort,
    limitReader: FriendLimitReaderPort,
    blockReader: UserBlockReaderPort,
    cache: FriendshipCachePort,
    notifier: FriendshipNotifierPort,
    notifyFirstFriendMilestone: NotifyFirstFriendMilestoneUseCase,
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
    friendshipRepository: FriendshipRepositoryPort,
    friendReader: FriendReaderPort,
    profileReader: FriendProfileReaderPort,
    cache: FriendshipCachePort,
    notifier: FriendshipNotifierPort,
    notifyFirstFriendMilestone: NotifyFirstFriendMilestoneUseCase,
    clock: ClockPort,
    logger: loggerFor(AcceptFriendRequestUseCase),
  }),
  provideUseCase(RejectFriendRequestUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    friendshipRepository: FriendshipRepositoryPort,
    logger: loggerFor(RejectFriendRequestUseCase),
  }),
  provideUseCase(RemoveFriendUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    friendshipRepository: FriendshipRepositoryPort,
    cache: FriendshipCachePort,
    logger: loggerFor(RemoveFriendUseCase),
  }),
  provideUseCase(ReorderFriendUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    friendshipRepository: FriendshipRepositoryPort,
    friendReader: FriendReaderPort,
    clock: ClockPort,
    logger: loggerFor(ReorderFriendUseCase),
  }),
  provideUseCase(EstablishFriendshipUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    afterCommit: AfterCommitTaskRegistryPort,
    friendshipRepository: FriendshipRepositoryPort,
    profileReader: FriendProfileReaderPort,
    limitReader: FriendLimitReaderPort,
    cache: FriendshipCachePort,
    notifier: FriendshipNotifierPort,
    notifyFirstFriendMilestone: NotifyFirstFriendMilestoneUseCase,
    clock: ClockPort,
    logger: loggerFor(EstablishFriendshipUseCase),
  }),
  provideUseCase(SeverFriendshipUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    afterCommit: AfterCommitTaskRegistryPort,
    friendshipRepository: FriendshipRepositoryPort,
    cache: FriendshipCachePort,
  }),
  provideUseCase(GetFriendsUseCase, {
    friendReader: FriendReaderPort,
    mutualFriendReader: MutualFriendReaderPort,
  }),
  provideUseCase(GetReceivedFriendRequestsUseCase, { friendReader: FriendReaderPort }),
  provideUseCase(GetSentFriendRequestsUseCase, { friendReader: FriendReaderPort }),
  provideUseCase(SearchUsersUseCase, {
    searchReader: FriendSearchReaderPort,
    logger: loggerFor(SearchUsersUseCase),
  }),
  provideUseCase(GetFriendResourceLimitUseCase, {
    mutualFriendReader: MutualFriendReaderPort,
    limitReader: FriendLimitReaderPort,
  }),
] satisfies Provider[];
