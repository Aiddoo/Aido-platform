import { INVITE_FRIENDSHIP, REDEEM_OUTCOME } from "@aido/api/vocabulary";

import type { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { hasReachedFriendLimit } from "../../domain/friend-limit.domain-service.js";
import { nextFriendSortOrder } from "../../domain/friend-ordering.domain-service.js";
import { Friendship } from "../../domain/friendship.aggregate.js";
import { FriendLockKeys } from "../friends.lock-keys.js";
import { FriendLogEvent } from "../friends.log-events.js";
import {
  type FriendshipCacheInvalidator,
  invalidateFriendshipCaches,
} from "../ports/follow-cache.port.js";
import type { FollowNotifierPort } from "../ports/follow-notifier.port.js";
import type { FollowRepositoryPort } from "../ports/follow.repository.port.js";
import type { FriendLimitReaderPort } from "../ports/friend-limit.reader.port.js";
import type { FriendProfileReaderPort } from "../ports/friend-profile.reader.port.js";
import type { FriendshipEstablishment } from "../ports/friendship-establisher.port.js";
import type { CheckFirstFriendMilestoneUseCase } from "./check-first-friend-milestone.use-case.js";

export interface EstablishFriendshipCommand {
  readonly requesterId: string;
  readonly targetUserId: string;
  readonly shouldNotifyFriends: boolean;
}

export interface EstablishFriendshipDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly afterCommit: Pick<AfterCommitTaskRegistryPort, "register">;
  readonly followRepository: Pick<
    FollowRepositoryPort,
    | "nextId"
    | "countMutualFriends"
    | "findByFollowerAndFollowing"
    | "findMaxFriendSortOrder"
    | "save"
  >;
  readonly profileReader: Pick<FriendProfileReaderPort, "findDisplayName">;
  readonly limitReader: Pick<FriendLimitReaderPort, "readLimitInTx">;
  readonly cache: FriendshipCacheInvalidator;
  readonly notifier: Pick<FollowNotifierPort, "notifyFollowNew" | "notifyFollowMutual">;
  readonly checkFirstFriendMilestone: Pick<CheckFirstFriendMilestoneUseCase, "execute">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/**
 * 친구 요청과 같은 잠금·한도 규칙으로 두 방향 관계를 한 번에 맺는다. 수락 흐름은 친구 요청과 합치지 않는다:
 * 친구 요청은 기존 요청이 있으면 거절하고 상대의 대기 요청만 자동 수락하지만, 초대는 두 방향의 대기 요청을
 * 모두 수락하고 결과를 상태로 돌려주며 호출자 UoW에 참여한다.
 */
export class EstablishFriendshipUseCase {
  readonly #dependencies: EstablishFriendshipDependencies;

  constructor(dependencies: EstablishFriendshipDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: EstablishFriendshipCommand): Promise<FriendshipEstablishment> {
    const { unitOfWork, mutationLock, followRepository, afterCommit } = this.#dependencies;
    const requesterId = UserId.reconstitute(command.requesterId);
    const targetUserId = UserId.reconstitute(command.targetUserId);

    return unitOfWork.run(async () => {
      await mutationLock.acquire([
        FriendLockKeys.pair(requesterId, targetUserId),
        FriendLockKeys.list(requesterId),
        FriendLockKeys.list(targetUserId),
      ]);
      const [forward, reverse] = await Promise.all([
        followRepository.findByFollowerAndFollowing(requesterId, targetUserId),
        followRepository.findByFollowerAndFollowing(targetUserId, requesterId),
      ]);
      if (forward?.isAccepted() && reverse?.isAccepted()) {
        return REDEEM_OUTCOME.ALREADY_FRIENDS;
      }

      const [isRequesterFull, isTargetFull] = await Promise.all([
        this.#isAtFriendLimit(requesterId),
        this.#isAtFriendLimit(targetUserId),
      ]);
      if (isRequesterFull) {
        return "UNAVAILABLE";
      }
      if (isTargetFull) {
        await this.#request(forward, requesterId, targetUserId);
        return INVITE_FRIENDSHIP.REQUESTED;
      }

      await this.#connect(forward, reverse, requesterId, targetUserId);
      afterCommit.register(() =>
        this.#afterConnected(requesterId, targetUserId, command.shouldNotifyFriends),
      );
      return INVITE_FRIENDSHIP.FRIENDS;
    });
  }

  async #isAtFriendLimit(userId: UserId): Promise<boolean> {
    const { followRepository, limitReader } = this.#dependencies;
    const [maxFriendCount, friendCount] = await Promise.all([
      limitReader.readLimitInTx(userId),
      followRepository.countMutualFriends(userId),
    ]);
    return hasReachedFriendLimit({ maxFriendCount, friendCount });
  }

  async #request(
    forward: Friendship | null,
    requesterId: UserId,
    targetUserId: UserId,
  ): Promise<void> {
    const { followRepository, afterCommit, profileReader, notifier, clock } = this.#dependencies;
    if (forward != null) {
      return;
    }

    await followRepository.save(
      Friendship.create({
        id: await followRepository.nextId(),
        followerId: requesterId,
        followingId: targetUserId,
        now: clock.now(),
      }),
    );
    afterCommit.register(async () => {
      notifier.notifyFollowNew({
        followerId: requesterId.value,
        followingId: targetUserId.value,
        followerName: (await profileReader.findDisplayName(requesterId)) ?? requesterId.value,
      });
    });
  }

  async #connect(
    forward: Friendship | null,
    reverse: Friendship | null,
    requesterId: UserId,
    targetUserId: UserId,
  ): Promise<void> {
    const { followRepository, clock } = this.#dependencies;
    const [requesterMaxSortOrder, targetMaxSortOrder] = await Promise.all([
      followRepository.findMaxFriendSortOrder(requesterId),
      followRepository.findMaxFriendSortOrder(targetUserId),
    ]);
    const now = clock.now();
    await this.#accept(forward, requesterId, targetUserId, {
      sortOrder: nextFriendSortOrder(requesterMaxSortOrder),
      now,
    });
    await this.#accept(reverse, targetUserId, requesterId, {
      sortOrder: nextFriendSortOrder(targetMaxSortOrder),
      now,
    });
  }

  // 이미 수락한 방향은 친구 목록 순서를 그대로 둔다
  async #accept(
    existing: Friendship | null,
    followerId: UserId,
    followingId: UserId,
    placement: { readonly sortOrder: number; readonly now: Temporal.Instant },
  ): Promise<void> {
    const { followRepository } = this.#dependencies;
    if (existing?.isAccepted()) {
      return;
    }
    const friendship =
      existing ??
      Friendship.create({
        id: await followRepository.nextId(),
        followerId,
        followingId,
        now: placement.now,
      });
    friendship.accept(placement.sortOrder, placement.now);
    await followRepository.save(friendship);
  }

  async #afterConnected(
    requesterId: UserId,
    targetUserId: UserId,
    shouldNotifyFriends: boolean,
  ): Promise<void> {
    const { profileReader, cache, notifier, checkFirstFriendMilestone, logger } =
      this.#dependencies;
    logger.log({
      event: FriendLogEvent.FRIENDSHIP_ESTABLISHED,
      userId: requesterId.value,
      targetUserId: targetUserId.value,
    });
    await invalidateFriendshipCaches(cache, requesterId, targetUserId);
    if (shouldNotifyFriends) {
      notifier.notifyFollowMutual({
        userId: targetUserId.value,
        friendId: requesterId.value,
        friendName: (await profileReader.findDisplayName(requesterId)) ?? requesterId.value,
      });
    }
    await checkFirstFriendMilestone.execute({
      userIds: [requesterId.value, targetUserId.value],
    });
  }
}
