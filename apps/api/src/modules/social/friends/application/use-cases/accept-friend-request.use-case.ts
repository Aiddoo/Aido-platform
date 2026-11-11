import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { nextFriendSortOrder } from "../../domain/friend-ordering.domain-service.js";
import { Friendship } from "../../domain/friendship.aggregate.js";
import { acceptedFriendNotFound, friendRequestNotFound } from "../friends.errors.js";
import { FriendLockKeys } from "../friends.lock-keys.js";
import { FriendLogEvent } from "../friends.log-events.js";
import {
  type FriendshipCacheInvalidator,
  invalidateFriendshipCaches,
} from "../ports/follow-cache.port.js";
import type { FollowNotifierPort } from "../ports/follow-notifier.port.js";
import type { FollowRepositoryPort } from "../ports/follow.repository.port.js";
import type { FriendProfileReaderPort } from "../ports/friend-profile.reader.port.js";
import type { FriendshipReaderPort } from "../ports/friendship.reader.port.js";
import type { FriendReadModel } from "../read-models/friend.read-model.js";
import type { CheckFirstFriendMilestoneUseCase } from "./check-first-friend-milestone.use-case.js";

export interface AcceptFriendRequestCommand {
  readonly userId: string;
  readonly requesterUserId: string;
}

export interface AcceptFriendRequestDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly followRepository: Pick<
    FollowRepositoryPort,
    "nextId" | "findByFollowerAndFollowing" | "findMaxFriendSortOrder" | "save"
  >;
  readonly friendshipReader: Pick<FriendshipReaderPort, "findFriendById">;
  readonly profileReader: Pick<FriendProfileReaderPort, "findDisplayName">;
  readonly cache: FriendshipCacheInvalidator;
  readonly notifier: Pick<FollowNotifierPort, "notifyFollowMutual">;
  readonly checkFirstFriendMilestone: Pick<CheckFirstFriendMilestoneUseCase, "execute">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class AcceptFriendRequestUseCase {
  readonly #dependencies: AcceptFriendRequestDependencies;

  constructor(dependencies: AcceptFriendRequestDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: AcceptFriendRequestCommand): Promise<FriendReadModel> {
    const { unitOfWork, mutationLock, cache, logger } = this.#dependencies;
    const userId = UserId.reconstitute(command.userId);
    const requesterUserId = UserId.reconstitute(command.requesterUserId);

    const friend = await unitOfWork.run(async () => {
      await mutationLock.acquire([
        FriendLockKeys.pair(userId, requesterUserId),
        FriendLockKeys.list(userId),
        FriendLockKeys.list(requesterUserId),
      ]);
      return this.#accept(userId, requesterUserId);
    });

    logger.log({
      event: FriendLogEvent.REQUEST_ACCEPTED,
      userId: userId.value,
      requesterUserId: requesterUserId.value,
    });
    await invalidateFriendshipCaches(cache, userId, requesterUserId);
    await this.#notifyRequester(userId, requesterUserId);
    return friend;
  }

  async #accept(userId: UserId, requesterUserId: UserId): Promise<FriendReadModel> {
    const { followRepository, friendshipReader, clock } = this.#dependencies;
    const request = await followRepository.findByFollowerAndFollowing(requesterUserId, userId);
    if (request == null || !request.isPending()) {
      throw friendRequestNotFound(requesterUserId);
    }

    const [userMaxSortOrder, requesterMaxSortOrder] = await Promise.all([
      followRepository.findMaxFriendSortOrder(userId),
      followRepository.findMaxFriendSortOrder(requesterUserId),
    ]);
    const now = clock.now();
    request.accept(nextFriendSortOrder(requesterMaxSortOrder), now);
    await followRepository.save(request);

    const mine =
      (await followRepository.findByFollowerAndFollowing(userId, requesterUserId)) ??
      Friendship.create({
        id: await followRepository.nextId(),
        followerId: userId,
        followingId: requesterUserId,
        now,
      });
    if (mine.accept(nextFriendSortOrder(userMaxSortOrder), now)) {
      await followRepository.save(mine);
    }

    const friend = await friendshipReader.findFriendById(mine.id);
    if (friend == null) {
      throw acceptedFriendNotFound({ friendshipId: mine.id, userId, requesterUserId });
    }
    return friend;
  }

  async #notifyRequester(userId: UserId, requesterUserId: UserId): Promise<void> {
    const { profileReader, notifier, checkFirstFriendMilestone } = this.#dependencies;
    notifier.notifyFollowMutual({
      userId: requesterUserId.value,
      friendId: userId.value,
      friendName: (await profileReader.findDisplayName(userId)) ?? userId.value,
    });
    await checkFirstFriendMilestone.execute({
      userIds: [userId.value, requesterUserId.value],
    });
  }
}
