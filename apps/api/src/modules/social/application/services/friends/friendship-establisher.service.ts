import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";
import { Resource } from "#api/modules/access/access-entitlement.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  type AfterCommitTaskRegistryPort,
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";

import type { Friendship } from "../../../domain/aggregates/friends/friendship.aggregate.js";
import { hasReachedFriendLimit } from "../../../domain/policies/friends/friend-limit.policy.js";
import { SocialFriendLogEvent } from "../../observability/friends/social-friend-log.events.js";
import type { FollowNotifierPort } from "../../ports/friends/follow-notifier.port.js";
import type { FollowRepositoryPort } from "../../ports/friends/follow.repository.port.js";
import type {
  EstablishFriendshipInput,
  FriendshipEstablisherPort,
  FriendshipEstablishment,
} from "../../ports/friends/friendship-establisher.port.js";
import type { FriendshipEffects } from "./friendship-effects.service.js";

interface FriendshipEstablisherDependencies {
  readonly followRepository: Pick<
    FollowRepositoryPort,
    | "countMutualFriends"
    | "findByFollowerAndFollowing"
    | "create"
    | "update"
    | "getMaxSortOrderForFriends"
    | "getUserDisplayName"
  >;
  readonly entitlementReader: Pick<EntitlementReaderPort, "getResourceLimitInTx">;
  readonly notifier: Pick<FollowNotifierPort, "notifyFollowNew">;
  readonly effects: Pick<
    FriendshipEffects,
    "invalidateFriendshipCaches" | "notifyMutual" | "checkFirstFriendMilestone"
  >;
  readonly mutationLock: MutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly afterCommitTasks: Pick<AfterCommitTaskRegistryPort, "register">;
  readonly logger: ApplicationLogger;
}

/**
 * 친구 요청과 같은 잠금·한도 규칙으로 두 방향 관계를 한 번에 맺는다.
 * 한도 판단은 SendFriendRequest와 hasReachedFriendLimit을 함께 쓴다. 수락 흐름은 합치지 않는다:
 * 친구 요청은 기존 요청이 있으면 오류로 거절하고 상대의 대기 요청만 자동 수락하며 알림을 커밋 뒤
 * 바로 보내지만, 초대는 두 방향의 대기 요청을 모두 수락하고 결과를 상태로 돌려주며 호출자 UoW에 참여한다.
 */
export class FriendshipEstablisher implements FriendshipEstablisherPort {
  readonly #dependencies: FriendshipEstablisherDependencies;

  constructor(dependencies: FriendshipEstablisherDependencies) {
    this.#dependencies = dependencies;
  }

  async establish(input: EstablishFriendshipInput): Promise<FriendshipEstablishment> {
    const { requesterId, targetUserId } = input;

    return this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        MutationLockKeys.friendPair(requesterId, targetUserId),
        MutationLockKeys.friendList(requesterId),
        MutationLockKeys.friendList(targetUserId),
      ]);
      const [forward, reverse] = await Promise.all([
        this.#dependencies.followRepository.findByFollowerAndFollowing(requesterId, targetUserId),
        this.#dependencies.followRepository.findByFollowerAndFollowing(targetUserId, requesterId),
      ]);
      if (forward?.isAccepted() && reverse?.isAccepted()) {
        return "ALREADY_FRIENDS";
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
        return "REQUESTED";
      }

      await this.#connect(forward, reverse, requesterId, targetUserId);
      this.#dependencies.afterCommitTasks.register(() =>
        this.#afterConnected(requesterId, targetUserId, input.shouldNotifyFriends),
      );
      return "FRIENDS";
    });
  }

  async #isAtFriendLimit(userId: string): Promise<boolean> {
    const [entitlement, friendCount] = await Promise.all([
      this.#dependencies.entitlementReader.getResourceLimitInTx(userId, Resource.FRIEND),
      this.#dependencies.followRepository.countMutualFriends(userId),
    ]);
    return hasReachedFriendLimit(entitlement.maxCount, friendCount);
  }

  async #request(
    forward: Friendship | null,
    requesterId: string,
    targetUserId: string,
  ): Promise<void> {
    if (forward !== null) {
      return;
    }

    await this.#dependencies.followRepository.create({
      followerId: requesterId,
      followingId: targetUserId,
      status: "PENDING",
    });
    this.#dependencies.afterCommitTasks.register(async () => {
      const followerName =
        await this.#dependencies.followRepository.getUserDisplayName(requesterId);
      this.#dependencies.notifier.notifyFollowNew({
        followerId: requesterId,
        followingId: targetUserId,
        followerName,
      });
    });
  }

  async #connect(
    forward: Friendship | null,
    reverse: Friendship | null,
    requesterId: string,
    targetUserId: string,
  ): Promise<void> {
    const [requesterSortOrder, targetSortOrder] = await Promise.all([
      this.#dependencies.followRepository.getMaxSortOrderForFriends(requesterId),
      this.#dependencies.followRepository.getMaxSortOrderForFriends(targetUserId),
    ]);
    await this.#accept(forward, requesterId, targetUserId, requesterSortOrder + 1);
    await this.#accept(reverse, targetUserId, requesterId, targetSortOrder + 1);
  }

  async #accept(
    existing: Friendship | null,
    followerId: string,
    followingId: string,
    sortOrder: number,
  ): Promise<void> {
    if (existing === null) {
      await this.#dependencies.followRepository.create({
        followerId,
        followingId,
        status: "ACCEPTED",
        sortOrder,
      });
      return;
    }
    if (existing.isPending()) {
      existing.accept(sortOrder);
      await this.#dependencies.followRepository.update(existing.id, existing.toUpdate());
    }
  }

  async #afterConnected(
    requesterId: string,
    targetUserId: string,
    shouldNotifyFriends: boolean,
  ): Promise<void> {
    this.#dependencies.logger.log({
      event: SocialFriendLogEvent.FRIENDSHIP_ESTABLISHED,
      userId: requesterId,
      targetUserId,
    });
    await this.#dependencies.effects.invalidateFriendshipCaches(requesterId, targetUserId);
    if (shouldNotifyFriends) {
      const [requesterName, targetName] = await Promise.all([
        this.#dependencies.followRepository.getUserDisplayName(requesterId),
        this.#dependencies.followRepository.getUserDisplayName(targetUserId),
      ]);
      this.#dependencies.effects.notifyMutual({
        userId: requesterId,
        friendId: targetUserId,
        friendName: targetName,
      });
      this.#dependencies.effects.notifyMutual({
        userId: targetUserId,
        friendId: requesterId,
        friendName: requesterName,
      });
    }
    await Promise.all([
      this.#dependencies.effects.checkFirstFriendMilestone(requesterId),
      this.#dependencies.effects.checkFirstFriendMilestone(targetUserId),
    ]);
  }
}
