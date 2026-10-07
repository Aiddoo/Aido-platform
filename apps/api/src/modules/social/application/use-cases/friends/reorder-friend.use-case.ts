import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type {
  ReorderPlan,
  ReorderPosition,
} from "../../../domain/policies/friends/friend-reorder.policy.js";
import { SocialFriendLogEvent } from "../../observability/friends/social-friend-log.events.js";
import {
  type FollowRepositoryPort,
  type FollowWithUser,
} from "../../ports/friends/follow.repository.port.js";

export interface ReorderFriendInput {
  readonly followId: string;
  readonly userId: string;
  readonly targetFollowId?: string;
  readonly position: ReorderPosition;
}

interface ReorderFriendDependencies {
  readonly followRepository: Pick<
    FollowRepositoryPort,
    | "findAcceptedByIdAndFollowerId"
    | "findByIdWithUser"
    | "getMaxSortOrderForFriends"
    | "shiftFriendSortOrders"
    | "updateFollowSortOrder"
  >;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly logger: ApplicationLogger;
}

export class ReorderFriend {
  readonly #dependencies: ReorderFriendDependencies;

  constructor(dependencies: ReorderFriendDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ReorderFriendInput): Promise<FollowWithUser> {
    const { followId, userId, targetFollowId, position } = input;

    return this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([MutationLockKeys.friendList(userId)]);
      const follow = await this.#dependencies.followRepository.findAcceptedByIdAndFollowerId(
        followId,
        userId,
      );
      if (follow === null) {
        throw new ApplicationException(ErrorCode.FOLLOW_0910, {
          targetFollowId: followId,
        });
      }

      if (targetFollowId === followId) {
        const withUser = await this.#dependencies.followRepository.findByIdWithUser(followId);
        if (withUser === null) {
          throw new ApplicationException(ErrorCode.FOLLOW_0910, {
            targetFollowId: followId,
          });
        }
        return withUser;
      }

      let plan: ReorderPlan;
      if (targetFollowId !== undefined) {
        const target = await this.#dependencies.followRepository.findAcceptedByIdAndFollowerId(
          targetFollowId,
          userId,
        );
        if (target === null) {
          throw new ApplicationException(ErrorCode.FOLLOW_0910, {
            targetFollowId,
          });
        }
        plan = follow.planReorderRelativeTo(target.sortOrder, position);
      } else {
        const maxSortOrder =
          await this.#dependencies.followRepository.getMaxSortOrderForFriends(userId);
        plan = follow.planReorderToEdge(position, maxSortOrder);
      }

      await this.#dependencies.followRepository.shiftFriendSortOrders(
        userId,
        plan.shift.from,
        plan.shift.to,
        plan.shift.delta,
      );
      const updated = await this.#dependencies.followRepository.updateFollowSortOrder(
        followId,
        plan.newSortOrder,
      );

      this.#dependencies.logger.log({
        event: SocialFriendLogEvent.REORDERED,
        followId,
        userId,
        sortOrder: plan.newSortOrder,
      });

      return updated;
    });
  }
}
