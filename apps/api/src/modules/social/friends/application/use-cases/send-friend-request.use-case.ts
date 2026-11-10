import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserBlockReaderPort } from "../../../blocks/application/ports/user-block.reader.port.js";
import { hasReachedFriendLimit } from "../../domain/friend-limit.domain-service.js";
import { nextFriendSortOrder } from "../../domain/friend-ordering.domain-service.js";
import { Friendship } from "../../domain/friendship.aggregate.js";
import {
  alreadyFriends,
  blockedTargetRequested,
  cannotFriendSelf,
  friendLimitReached,
  friendRequestAlreadySent,
  friendTargetNotFound,
} from "../friends.errors.js";
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
import type { CheckFirstFriendMilestoneUseCase } from "./check-first-friend-milestone.use-case.js";

export interface SendFriendRequestCommand {
  readonly userId: string;
  readonly targetUserId: string;
}

export interface SendFriendRequestResult {
  readonly friendship: Friendship;
  // 상대가 먼저 보낸 요청이 있어 바로 친구가 됐는지다
  readonly isAutoAccepted: boolean;
}

export interface SendFriendRequestDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly followRepository: Pick<
    FollowRepositoryPort,
    | "nextId"
    | "countMutualFriends"
    | "findByFollowerAndFollowing"
    | "findMaxFriendSortOrder"
    | "save"
  >;
  readonly profileReader: Pick<FriendProfileReaderPort, "existsActiveUser" | "findDisplayName">;
  readonly limitReader: Pick<FriendLimitReaderPort, "readLimitInTx" | "readFeatureQuotaInTx">;
  readonly blockReader: Pick<UserBlockReaderPort, "findRelation">;
  readonly cache: FriendshipCacheInvalidator;
  readonly notifier: Pick<FollowNotifierPort, "notifyFollowNew" | "notifyFollowMutual">;
  readonly checkFirstFriendMilestone: Pick<CheckFirstFriendMilestoneUseCase, "execute">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class SendFriendRequestUseCase {
  readonly #dependencies: SendFriendRequestDependencies;

  constructor(dependencies: SendFriendRequestDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: SendFriendRequestCommand): Promise<SendFriendRequestResult> {
    const { unitOfWork, mutationLock } = this.#dependencies;
    const userId = UserId.reconstitute(command.userId);
    const targetUserId = UserId.reconstitute(command.targetUserId);
    if (userId.equals(targetUserId)) {
      throw cannotFriendSelf();
    }

    const result = await unitOfWork.run(async () => {
      await mutationLock.acquire([
        FriendLockKeys.pair(userId, targetUserId),
        FriendLockKeys.list(userId),
        FriendLockKeys.list(targetUserId),
      ]);
      // 한도를 대상 확인보다 먼저 본다(출시 앱이 받는 오류 우선순위)
      await this.#assertBelowFriendLimit(userId);
      await this.#assertRequestable(userId, targetUserId);
      return this.#request(userId, targetUserId);
    });

    if (result.isAutoAccepted) {
      await this.#afterAutoAccepted(userId, targetUserId);
    } else {
      await this.#afterRequested(userId, targetUserId);
    }
    return result;
  }

  async #assertBelowFriendLimit(userId: UserId): Promise<void> {
    const { followRepository, limitReader } = this.#dependencies;
    const [maxFriendCount, friendCount] = await Promise.all([
      limitReader.readLimitInTx(userId),
      followRepository.countMutualFriends(userId),
    ]);
    if (hasReachedFriendLimit({ maxFriendCount, friendCount })) {
      throw friendLimitReached({
        friendCount,
        maxFriendCount,
        featureQuota: await limitReader.readFeatureQuotaInTx(userId, friendCount),
      });
    }
  }

  async #assertRequestable(userId: UserId, targetUserId: UserId): Promise<void> {
    const { followRepository, profileReader, blockReader } = this.#dependencies;
    if (!(await profileReader.existsActiveUser(targetUserId))) {
      throw friendTargetNotFound(targetUserId);
    }
    // 차단과 같은 쌍 잠금 아래에서 읽어 차단 직후 요청이 친구 관계를 되살리지 못하게 한다
    const blockRelation = await blockReader.findRelation(userId.value, targetUserId.value);
    if (blockRelation.isBlocking) {
      throw blockedTargetRequested(targetUserId);
    }
    // 차단당한 사람에게는 차단 사실을 알리지 않도록 없는 사용자와 같은 오류로 답한다
    if (blockRelation.isBlockedBy) {
      throw friendTargetNotFound(targetUserId);
    }
    const existing = await followRepository.findByFollowerAndFollowing(userId, targetUserId);
    if (existing?.isAccepted()) {
      throw alreadyFriends(targetUserId);
    }
    if (existing != null) {
      throw friendRequestAlreadySent(targetUserId);
    }
  }

  async #request(userId: UserId, targetUserId: UserId): Promise<SendFriendRequestResult> {
    const { followRepository, clock } = this.#dependencies;
    const reverse = await followRepository.findByFollowerAndFollowing(targetUserId, userId);
    if (reverse?.isAccepted()) {
      throw alreadyFriends(targetUserId);
    }

    const now = clock.now();
    const friendship = Friendship.create({
      id: await followRepository.nextId(),
      followerId: userId,
      followingId: targetUserId,
      now,
    });
    if (reverse == null) {
      await followRepository.save(friendship);
      return { friendship, isAutoAccepted: false };
    }

    const [userMaxSortOrder, targetMaxSortOrder] = await Promise.all([
      followRepository.findMaxFriendSortOrder(userId),
      followRepository.findMaxFriendSortOrder(targetUserId),
    ]);
    reverse.accept(nextFriendSortOrder(targetMaxSortOrder), now);
    await followRepository.save(reverse);
    friendship.accept(nextFriendSortOrder(userMaxSortOrder), now);
    await followRepository.save(friendship);
    return { friendship, isAutoAccepted: true };
  }

  async #afterRequested(userId: UserId, targetUserId: UserId): Promise<void> {
    const { profileReader, notifier, logger } = this.#dependencies;
    logger.log({
      event: FriendLogEvent.REQUEST_SENT,
      userId: userId.value,
      targetUserId: targetUserId.value,
    });
    notifier.notifyFollowNew({
      followerId: userId.value,
      followingId: targetUserId.value,
      followerName: (await profileReader.findDisplayName(userId)) ?? userId.value,
    });
  }

  async #afterAutoAccepted(userId: UserId, targetUserId: UserId): Promise<void> {
    const { profileReader, cache, notifier, checkFirstFriendMilestone, logger } =
      this.#dependencies;
    logger.log({
      event: FriendLogEvent.REQUEST_AUTO_ACCEPTED,
      userId: userId.value,
      targetUserId: targetUserId.value,
    });
    notifier.notifyFollowMutual({
      userId: targetUserId.value,
      friendId: userId.value,
      friendName: (await profileReader.findDisplayName(userId)) ?? userId.value,
    });
    await checkFirstFriendMilestone.execute({ userIds: [userId.value, targetUserId.value] });
    await invalidateFriendshipCaches(cache, userId.value, targetUserId.value);
  }
}
