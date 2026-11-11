import type { ReorderPosition } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  type FriendMovePlan,
  planFriendMoveRelativeTo,
  planFriendMoveToEdge,
} from "../../domain/friend-ordering.domain-service.js";
import { FriendshipId } from "../../domain/friendship-id.vo.js";
import type { Friendship } from "../../domain/friendship.aggregate.js";
import { reorderFriendNotFound } from "../friends.errors.js";
import { FriendLockKeys } from "../friends.lock-keys.js";
import { FriendLogEvent } from "../friends.log-events.js";
import type { FollowRepositoryPort } from "../ports/follow.repository.port.js";
import type { FriendshipReaderPort } from "../ports/friendship.reader.port.js";
import type { FriendReadModel } from "../read-models/friend.read-model.js";

export interface ReorderFriendCommand {
  readonly userId: string;
  readonly friendshipId: string;
  readonly position: ReorderPosition;
  // 없으면 맨 앞(before)·맨 뒤(after)로 옮긴다
  readonly targetFriendshipId?: string;
}

export interface ReorderFriendDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly followRepository: Pick<
    FollowRepositoryPort,
    "findAcceptedByIdAndFollowerId" | "findMaxFriendSortOrder" | "shiftFriendSortOrders" | "save"
  >;
  readonly friendshipReader: Pick<FriendshipReaderPort, "findFriendById">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class ReorderFriendUseCase {
  readonly #dependencies: ReorderFriendDependencies;

  constructor(dependencies: ReorderFriendDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: ReorderFriendCommand): Promise<FriendReadModel> {
    const { unitOfWork, mutationLock, followRepository, friendshipReader, clock, logger } =
      this.#dependencies;
    const userId = UserId.reconstitute(command.userId);
    const friendshipId = FriendshipId.reconstitute(command.friendshipId);

    const { friend, movedSortOrder } = await unitOfWork.run(async () => {
      await mutationLock.acquire([FriendLockKeys.list(userId)]);
      // 옮길 친구가 없으면 기준 친구보다 먼저 거절한다(출시 앱이 받는 오류 우선순위)
      const friendship = await followRepository.findAcceptedByIdAndFollowerId(friendshipId, userId);
      if (friendship == null) {
        throw reorderFriendNotFound(friendshipId);
      }

      let hasMoved = false;
      if (command.targetFriendshipId !== command.friendshipId) {
        const plan = await this.#planMove(friendship, userId, command);
        const now = clock.now();
        await followRepository.shiftFriendSortOrders(userId, plan.shift, now);
        hasMoved = friendship.moveTo(plan.sortOrder, now);
        if (hasMoved) {
          await followRepository.save(friendship);
        }
      }

      const found = await friendshipReader.findFriendById(friendshipId);
      if (found == null) {
        throw reorderFriendNotFound(friendshipId);
      }
      return { friend: found, movedSortOrder: hasMoved ? friendship.sortOrder : null };
    });

    if (movedSortOrder != null) {
      logger.log({
        event: FriendLogEvent.REORDERED,
        followId: command.friendshipId,
        userId: command.userId,
        sortOrder: movedSortOrder,
      });
    }
    return friend;
  }

  async #planMove(
    friendship: Friendship,
    userId: UserId,
    command: ReorderFriendCommand,
  ): Promise<FriendMovePlan> {
    const { followRepository } = this.#dependencies;
    const currentSortOrder = friendship.sortOrder;

    if (command.targetFriendshipId != null) {
      const targetFriendshipId = FriendshipId.reconstitute(command.targetFriendshipId);
      const target = await followRepository.findAcceptedByIdAndFollowerId(
        targetFriendshipId,
        userId,
      );
      if (target == null) {
        throw reorderFriendNotFound(targetFriendshipId);
      }
      return planFriendMoveRelativeTo({
        currentSortOrder,
        targetSortOrder: target.sortOrder,
        position: command.position,
      });
    }

    // 옮길 친구도 목록에 있어 최대 순서는 항상 있다
    const maxSortOrder =
      (await followRepository.findMaxFriendSortOrder(userId)) ?? currentSortOrder;
    return planFriendMoveToEdge({ currentSortOrder, position: command.position, maxSortOrder });
  }
}
