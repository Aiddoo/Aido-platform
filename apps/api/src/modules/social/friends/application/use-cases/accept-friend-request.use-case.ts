import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { nextFriendSortOrder } from "../../domain/friend-ordering.domain-service.js";
import { FriendshipId } from "../../domain/friendship-id.vo.js";
import { Friendship } from "../../domain/friendship.aggregate.js";
import { acceptedFriendNotFound, friendRequestNotFound } from "../friends.errors.js";
import { FriendLockKeys } from "../friends.lock-keys.js";
import { FriendLogEvent } from "../friends.log-events.js";
import {
  type FriendProfileReaderPort,
  readDisplayName,
} from "../ports/friend-profile.reader.port.js";
import type { FriendReaderPort } from "../ports/friend.reader.port.js";
import {
  type FriendshipCacheInvalidator,
  invalidateFriendshipCaches,
} from "../ports/friendship-cache.port.js";
import type { FriendshipNotifierPort } from "../ports/friendship-notifier.port.js";
import type { FriendshipRepositoryPort } from "../ports/friendship.repository.port.js";
import type { FriendReadModel } from "../read-models/friend.read-model.js";
import type { NotifyFirstFriendMilestoneUseCase } from "./notify-first-friend-milestone.use-case.js";

export interface AcceptFriendRequestCommand {
  readonly userId: string;
  readonly requesterUserId: string;
}

export interface AcceptFriendRequestDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly friendshipRepository: Pick<
    FriendshipRepositoryPort,
    "findByFollowerAndFollowing" | "findMaxFriendSortOrder" | "save"
  >;
  readonly friendReader: Pick<FriendReaderPort, "findFriendById">;
  readonly profileReader: Pick<FriendProfileReaderPort, "findDisplayName">;
  readonly cache: FriendshipCacheInvalidator;
  readonly notifier: Pick<FriendshipNotifierPort, "notifyFollowMutual">;
  readonly notifyFirstFriendMilestone: Pick<NotifyFirstFriendMilestoneUseCase, "execute">;
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
      const accepted = await this.#accept(userId, requesterUserId);
      await this.#notifyRequester(userId, requesterUserId);
      return accepted;
    });

    logger.log({
      event: FriendLogEvent.REQUEST_ACCEPTED,
      userId: userId.value,
      requesterUserId: requesterUserId.value,
    });
    await invalidateFriendshipCaches(cache, userId, requesterUserId);
    return friend;
  }

  async #accept(userId: UserId, requesterUserId: UserId): Promise<FriendReadModel> {
    const { friendshipRepository, friendReader, clock } = this.#dependencies;
    const request = await friendshipRepository.findByFollowerAndFollowing(requesterUserId, userId);
    if (request == null || !request.isPending()) {
      throw friendRequestNotFound(requesterUserId);
    }

    const userMaxSortOrder = await friendshipRepository.findMaxFriendSortOrder(userId);
    const requesterMaxSortOrder =
      await friendshipRepository.findMaxFriendSortOrder(requesterUserId);
    const now = clock.now();
    request.accept(nextFriendSortOrder(requesterMaxSortOrder), now);
    await friendshipRepository.save(request);

    const mine =
      (await friendshipRepository.findByFollowerAndFollowing(userId, requesterUserId)) ??
      Friendship.create({
        id: FriendshipId.generate(),
        followerId: userId,
        followingId: requesterUserId,
        now,
      });
    if (mine.accept(nextFriendSortOrder(userMaxSortOrder), now)) {
      await friendshipRepository.save(mine);
    }

    const friend = await friendReader.findFriendById(mine.id);
    if (friend == null) {
      throw acceptedFriendNotFound({ friendshipId: mine.id, userId, requesterUserId });
    }
    return friend;
  }

  async #notifyRequester(userId: UserId, requesterUserId: UserId): Promise<void> {
    const { profileReader, notifier, notifyFirstFriendMilestone } = this.#dependencies;
    await notifier.notifyFollowMutual({
      userId: requesterUserId.value,
      friendId: userId.value,
      friendName: await readDisplayName(profileReader, userId),
    });
    await notifyFirstFriendMilestone.execute({
      userIds: [userId.value, requesterUserId.value],
    });
  }
}
