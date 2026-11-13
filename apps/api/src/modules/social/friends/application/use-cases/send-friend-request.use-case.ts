import type { UserBlockReaderPort } from "#api/modules/social/blocks/social-block-queries.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { hasReachedFriendLimit } from "../../domain/friend-limit.domain-service.js";
import { nextFriendSortOrder } from "../../domain/friend-ordering.domain-service.js";
import { FriendshipId } from "../../domain/friendship-id.vo.js";
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
import type { FriendLimitReaderPort } from "../ports/friend-limit.reader.port.js";
import {
  type FriendProfileReaderPort,
  readDisplayName,
} from "../ports/friend-profile.reader.port.js";
import {
  type FriendshipCacheInvalidator,
  invalidateFriendshipCaches,
} from "../ports/friendship-cache.port.js";
import type { FriendshipNotifierPort } from "../ports/friendship-notifier.port.js";
import type { FriendshipRepositoryPort } from "../ports/friendship.repository.port.js";
import type { NotifyFirstFriendMilestoneUseCase } from "./notify-first-friend-milestone.use-case.js";

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
  readonly friendshipRepository: Pick<
    FriendshipRepositoryPort,
    "countMutualFriends" | "findByFollowerAndFollowing" | "findMaxFriendSortOrder" | "save"
  >;
  readonly profileReader: Pick<FriendProfileReaderPort, "existsActiveUser" | "findDisplayName">;
  readonly limitReader: Pick<FriendLimitReaderPort, "readLimitInTx" | "readFeatureQuotaInTx">;
  readonly blockReader: Pick<UserBlockReaderPort, "findRelation">;
  readonly cache: FriendshipCacheInvalidator;
  readonly notifier: Pick<FriendshipNotifierPort, "notifyFollowNew" | "notifyFollowMutual">;
  readonly notifyFirstFriendMilestone: Pick<NotifyFirstFriendMilestoneUseCase, "execute">;
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
      const requested = await this.#request(userId, targetUserId);
      await this.#notify(userId, targetUserId, requested.isAutoAccepted);
      return requested;
    });

    await this.#afterCommit(userId, targetUserId, result.isAutoAccepted);
    return result;
  }

  async #assertBelowFriendLimit(userId: UserId): Promise<void> {
    const { friendshipRepository, limitReader } = this.#dependencies;
    const maxFriendCount = await limitReader.readLimitInTx(userId);
    const friendCount = await friendshipRepository.countMutualFriends(userId);
    if (hasReachedFriendLimit({ maxFriendCount, friendCount })) {
      throw friendLimitReached({
        friendCount,
        maxFriendCount,
        featureQuota: await limitReader.readFeatureQuotaInTx(userId, friendCount),
      });
    }
  }

  async #assertRequestable(userId: UserId, targetUserId: UserId): Promise<void> {
    const { friendshipRepository, profileReader, blockReader } = this.#dependencies;
    if (!(await profileReader.existsActiveUser(targetUserId))) {
      throw friendTargetNotFound(targetUserId);
    }
    // 차단과 같은 쌍 잠금 아래에서 읽어 차단 직후 요청이 친구 관계를 되살리지 못하게 한다
    const blockRelation = await blockReader.findRelation(userId, targetUserId);
    if (blockRelation.isBlocking) {
      throw blockedTargetRequested(targetUserId);
    }
    // 차단당한 사람에게는 차단 사실을 알리지 않도록 없는 사용자와 같은 오류로 답한다
    if (blockRelation.isBlockedBy) {
      throw friendTargetNotFound(targetUserId);
    }
    const existing = await friendshipRepository.findByFollowerAndFollowing(userId, targetUserId);
    if (existing?.isAccepted()) {
      throw alreadyFriends(targetUserId);
    }
    if (existing != null) {
      throw friendRequestAlreadySent(targetUserId);
    }
  }

  async #request(userId: UserId, targetUserId: UserId): Promise<SendFriendRequestResult> {
    const { friendshipRepository, clock } = this.#dependencies;
    const reverse = await friendshipRepository.findByFollowerAndFollowing(targetUserId, userId);
    if (reverse?.isAccepted()) {
      throw alreadyFriends(targetUserId);
    }

    const now = clock.now();
    const friendship = Friendship.create({
      id: FriendshipId.generate(),
      followerId: userId,
      followingId: targetUserId,
      now,
    });
    if (reverse == null) {
      await friendshipRepository.save(friendship);
      return { friendship, isAutoAccepted: false };
    }

    const userMaxSortOrder = await friendshipRepository.findMaxFriendSortOrder(userId);
    const targetMaxSortOrder = await friendshipRepository.findMaxFriendSortOrder(targetUserId);
    reverse.accept(nextFriendSortOrder(targetMaxSortOrder), now);
    await friendshipRepository.save(reverse);
    friendship.accept(nextFriendSortOrder(userMaxSortOrder), now);
    await friendshipRepository.save(friendship);
    return { friendship, isAutoAccepted: true };
  }

  // 알림 작업은 친구 관계 변경과 같은 트랜잭션에 넣어 커밋 직후 프로세스가 멈춰도 잃지 않는다
  async #notify(userId: UserId, targetUserId: UserId, isAutoAccepted: boolean): Promise<void> {
    const { profileReader, notifier, notifyFirstFriendMilestone } = this.#dependencies;
    const userName = await readDisplayName(profileReader, userId);
    if (!isAutoAccepted) {
      await notifier.notifyFollowNew({
        followerId: userId.value,
        followingId: targetUserId.value,
        followerName: userName,
      });
      return;
    }
    await notifier.notifyFollowMutual({
      userId: targetUserId.value,
      friendId: userId.value,
      friendName: userName,
    });
    await notifyFirstFriendMilestone.execute({ userIds: [userId.value, targetUserId.value] });
  }

  async #afterCommit(userId: UserId, targetUserId: UserId, isAutoAccepted: boolean): Promise<void> {
    const { cache, logger } = this.#dependencies;
    logger.log({
      event: isAutoAccepted ? FriendLogEvent.REQUEST_AUTO_ACCEPTED : FriendLogEvent.REQUEST_SENT,
      userId: userId.value,
      targetUserId: targetUserId.value,
    });
    if (isAutoAccepted) {
      await invalidateFriendshipCaches(cache, userId, targetUserId);
    }
  }
}
