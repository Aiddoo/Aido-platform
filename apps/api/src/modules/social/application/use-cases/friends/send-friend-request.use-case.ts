import { ErrorCode } from "@aido/api/errors";

import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";
import { Resource } from "#api/modules/access/access-entitlement.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type { Friendship } from "../../../domain/aggregates/friends/friendship.aggregate.js";
import { hasReachedFriendLimit } from "../../../domain/policies/friends/friend-limit.policy.js";
import { SocialFriendLogEvent } from "../../observability/friends/social-friend-log.events.js";
import { type UserBlockReaderPort } from "../../ports/blocks/user-block-reader.port.js";
import { type FollowNotifierPort } from "../../ports/friends/follow-notifier.port.js";
import { type FollowRepositoryPort } from "../../ports/friends/follow.repository.port.js";
import type { FriendshipEffects } from "../../services/friends/friendship-effects.service.js";

export interface SendFriendRequestInput {
  readonly userId: string;
  readonly targetUserId: string;
}

export interface SendFriendRequestResult {
  readonly follow: Friendship;
  readonly autoAccepted: boolean;
}

interface SendFriendRequestDependencies {
  readonly followRepository: Pick<
    FollowRepositoryPort,
    | "countMutualFriends"
    | "userExists"
    | "findByFollowerAndFollowing"
    | "create"
    | "getMaxSortOrderForFriends"
    | "update"
    | "getUserDisplayName"
  >;
  readonly notifier: Pick<FollowNotifierPort, "notifyFollowNew">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly entitlementReader: Pick<EntitlementReaderPort, "getResourceLimitInTx">;
  readonly blockReader: Pick<UserBlockReaderPort, "findRelation">;
  readonly effects: Pick<
    FriendshipEffects,
    "invalidateFriendshipCaches" | "notifyMutual" | "checkFirstFriendMilestone"
  >;
  readonly logger: ApplicationLogger;
}

export class SendFriendRequest {
  readonly #dependencies: SendFriendRequestDependencies;

  constructor(dependencies: SendFriendRequestDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendFriendRequestInput): Promise<SendFriendRequestResult> {
    const { userId, targetUserId } = input;
    if (userId === targetUserId) {
      throw new ApplicationException(ErrorCode.FOLLOW_0904);
    }

    const result = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        MutationLockKeys.friendPair(userId, targetUserId),
        MutationLockKeys.friendList(userId),
        MutationLockKeys.friendList(targetUserId),
      ]);
      const [entitlement, friendCount] = await Promise.all([
        this.#dependencies.entitlementReader.getResourceLimitInTx(userId, Resource.FRIEND),
        this.#dependencies.followRepository.countMutualFriends(userId),
      ]);
      if (hasReachedFriendLimit(entitlement.maxCount, friendCount)) {
        throw new ApplicationException(ErrorCode.FOLLOW_0909, {
          current: friendCount,
          limit: entitlement.maxCount,
        });
      }

      const targetExists = await this.#dependencies.followRepository.userExists(targetUserId);
      if (!targetExists) {
        throw new ApplicationException(ErrorCode.FOLLOW_0905, { targetUserId });
      }
      // 차단과 같은 쌍 잠금 아래에서 읽어 차단 직후 요청이 친구 관계를 되살리지 못하게 한다.
      const blockRelation = await this.#dependencies.blockReader.findRelation(userId, targetUserId);
      if (blockRelation.isBlocking) {
        throw new ApplicationException(ErrorCode.BLOCK_2203, { targetUserId });
      }
      // 차단당한 사람에게는 차단 사실을 알리지 않도록 없는 사용자와 같은 오류로 답한다.
      if (blockRelation.isBlockedBy) {
        throw new ApplicationException(ErrorCode.FOLLOW_0905, { targetUserId });
      }
      const existingFollow = await this.#dependencies.followRepository.findByFollowerAndFollowing(
        userId,
        targetUserId,
      );
      if (existingFollow?.isAccepted()) {
        throw new ApplicationException(ErrorCode.FOLLOW_0902, { targetUserId });
      }
      if (existingFollow !== null) {
        throw new ApplicationException(ErrorCode.FOLLOW_0901, { targetUserId });
      }
      const reverseFollow = await this.#dependencies.followRepository.findByFollowerAndFollowing(
        targetUserId,
        userId,
      );
      if (reverseFollow?.isAccepted()) {
        throw new ApplicationException(ErrorCode.FOLLOW_0902, { targetUserId });
      }
      if (reverseFollow?.isPending()) {
        const [maxSortUser, maxSortTarget] = await Promise.all([
          this.#dependencies.followRepository.getMaxSortOrderForFriends(userId),
          this.#dependencies.followRepository.getMaxSortOrderForFriends(targetUserId),
        ]);
        reverseFollow.accept(maxSortTarget + 1);
        await this.#dependencies.followRepository.update(
          reverseFollow.id,
          reverseFollow.toUpdate(),
        );
        const follow = await this.#dependencies.followRepository.create({
          followerId: userId,
          followingId: targetUserId,
          status: "ACCEPTED",
          sortOrder: maxSortUser + 1,
        });
        return { follow, autoAccepted: true };
      }
      const follow = await this.#dependencies.followRepository.create({
        followerId: userId,
        followingId: targetUserId,
        status: "PENDING",
      });
      return { follow, autoAccepted: false };
    });

    if (result.autoAccepted) {
      await this.#notifyAutoAcceptance(userId, targetUserId);
    } else {
      this.#dependencies.logger.log({
        event: SocialFriendLogEvent.REQUEST_SENT,
        userId,
        targetUserId,
      });
      const followerName = await this.#dependencies.followRepository.getUserDisplayName(userId);
      this.#dependencies.notifier.notifyFollowNew({
        followerId: userId,
        followingId: targetUserId,
        followerName,
      });
    }
    return result;
  }

  async #notifyAutoAcceptance(userId: string, targetUserId: string): Promise<void> {
    this.#dependencies.logger.log({
      event: SocialFriendLogEvent.REQUEST_AUTO_ACCEPTED,
      userId,
      targetUserId,
    });
    const [userName, targetUserName] = await Promise.all([
      this.#dependencies.followRepository.getUserDisplayName(userId),
      this.#dependencies.followRepository.getUserDisplayName(targetUserId),
    ]);
    this.#dependencies.effects.notifyMutual({
      userId,
      friendId: targetUserId,
      friendName: targetUserName,
    });
    this.#dependencies.effects.notifyMutual({
      userId: targetUserId,
      friendId: userId,
      friendName: userName,
    });
    await Promise.all([
      this.#dependencies.effects.checkFirstFriendMilestone(userId),
      this.#dependencies.effects.checkFirstFriendMilestone(targetUserId),
    ]);
    await this.#dependencies.effects.invalidateFriendshipCaches(userId, targetUserId);
  }
}
