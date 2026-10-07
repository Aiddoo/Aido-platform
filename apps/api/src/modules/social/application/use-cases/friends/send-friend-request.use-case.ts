import { ErrorCode } from "@aido/api/errors";

import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";
import { Resource } from "#api/modules/access/access-entitlement.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type { Friendship } from "../../../domain/aggregates/friends/friendship.aggregate.js";
import { type FollowNotifierPort } from "../../ports/friends/follow-notifier.port.js";
import { type FollowRepositoryPort } from "../../ports/friends/follow.repository.port.js";
import type { FollowReader } from "../../services/friends/follow.reader.js";
import type { FriendshipEffects } from "../../services/friends/friendship-effects.service.js";

export interface SendFriendRequestInput {
  userId: string;
  targetUserId: string;
}

export interface SendFriendRequestResult {
  follow: Friendship;
  autoAccepted: boolean;
}

/**
 * 친구 요청 보내기 use-case.
 *
 * 자기 자신 체크 → 리소스 한도 → 대상 존재 → 기존 관계 검증 순으로 진행하며,
 * 상대가 이미 나에게 PENDING 요청을 보낸 경우 트랜잭션으로 자동 수락한다.
 * 유니크 제약 위반(SQLSTATE 23505)은 저장소 어댑터가 FOLLOW_0901로 번역한다.
 */
interface SendFriendRequestDependencies {
  readonly followRepository: FollowRepositoryPort;
  readonly notifier: FollowNotifierPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly entitlementReader: Pick<EntitlementReaderPort, "getResourceLimit">;
  readonly reader: FollowReader;
  readonly effects: FriendshipEffects;
  readonly logger: ApplicationLogger;
}

export class SendFriendRequest {
  readonly #dependencies: SendFriendRequestDependencies;

  constructor(dependencies: SendFriendRequestDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendFriendRequestInput): Promise<SendFriendRequestResult> {
    const { userId, targetUserId } = input;

    // 1. 자기 자신 체크
    if (userId === targetUserId) {
      throw new ApplicationException(ErrorCode.FOLLOW_0904);
    }

    // 2. 리소스 한도 체크
    const [entitlement, friendCount] = await Promise.all([
      this.#dependencies.entitlementReader.getResourceLimit(userId, Resource.FRIEND),
      this.#dependencies.reader.countFriends(userId),
    ]);
    if (entitlement.maxCount !== null && friendCount >= entitlement.maxCount) {
      throw new ApplicationException(ErrorCode.FOLLOW_0909, {
        current: friendCount,
        limit: entitlement.maxCount,
      });
    }

    // 3. 대상 사용자 존재 체크
    const targetExists = await this.#dependencies.followRepository.userExists(targetUserId);
    if (!targetExists) {
      throw new ApplicationException(ErrorCode.FOLLOW_0905, { targetUserId });
    }

    // 4. 기존 관계 체크
    const existingFollow = await this.#dependencies.followRepository.findByFollowerAndFollowing(
      userId,
      targetUserId,
    );
    if (existingFollow?.isAccepted()) {
      throw new ApplicationException(ErrorCode.FOLLOW_0902, { targetUserId });
    }
    if (existingFollow) {
      throw new ApplicationException(ErrorCode.FOLLOW_0901, { targetUserId });
    }

    // 5. 상대방이 이미 나에게 요청을 보냈는지 확인
    const reverseFollow = await this.#dependencies.followRepository.findByFollowerAndFollowing(
      targetUserId,
      userId,
    );
    if (reverseFollow?.isAccepted()) {
      throw new ApplicationException(ErrorCode.FOLLOW_0902, { targetUserId });
    }

    if (reverseFollow?.isPending()) {
      return this.#autoAccept(userId, targetUserId);
    }

    // 6. 새 PENDING 요청 생성
    const follow = await this.#dependencies.followRepository.create({
      followerId: userId,
      followingId: targetUserId,
      status: "PENDING",
    });

    this.#dependencies.logger.log(`Friend request sent: ${userId} -> ${targetUserId}`);

    const followerName = await this.#dependencies.followRepository.getUserDisplayName(userId);
    this.#dependencies.notifier.notifyFollowNew({
      followerId: userId,
      followingId: targetUserId,
      followerName,
    });

    return { follow, autoAccepted: false };
  }

  async #autoAccept(userId: string, targetUserId: string): Promise<SendFriendRequestResult> {
    const follow = await this.#dependencies.unitOfWork.run(async () => {
      const [maxSortUser, maxSortTarget] = await Promise.all([
        this.#dependencies.followRepository.getMaxSortOrderForFriends(userId),
        this.#dependencies.followRepository.getMaxSortOrderForFriends(targetUserId),
      ]);

      await this.#dependencies.followRepository.updateByFollowerAndFollowing(targetUserId, userId, {
        status: "ACCEPTED",
        sortOrder: maxSortTarget + 1,
      });

      return this.#dependencies.followRepository.create({
        followerId: userId,
        followingId: targetUserId,
        status: "ACCEPTED",
        sortOrder: maxSortUser + 1,
      });
    });

    this.#dependencies.logger.log(`Friend request auto-accepted: ${userId} <-> ${targetUserId}`);

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

    return { follow, autoAccepted: true };
  }
}
