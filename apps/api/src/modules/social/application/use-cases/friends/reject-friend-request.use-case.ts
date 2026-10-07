import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { SocialFriendLogEvent } from "../../observability/friends/social-friend-log.events.js";
import { type FollowRepositoryPort } from "../../ports/friends/follow.repository.port.js";

export interface RejectFriendRequestInput {
  readonly userId: string;
  readonly requesterUserId: string;
}

interface RejectFriendRequestDependencies {
  readonly followRepository: Pick<FollowRepositoryPort, "findByFollowerAndFollowing" | "delete">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly logger: ApplicationLogger;
}

export class RejectFriendRequest {
  readonly #dependencies: RejectFriendRequestDependencies;

  constructor(dependencies: RejectFriendRequestDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RejectFriendRequestInput): Promise<void> {
    const { userId, requesterUserId } = input;

    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        MutationLockKeys.friendPair(userId, requesterUserId),
      ]);
      const request = await this.#dependencies.followRepository.findByFollowerAndFollowing(
        requesterUserId,
        userId,
      );
      if (request === null || !request.isPending()) {
        throw new ApplicationException(ErrorCode.FOLLOW_0903, {
          targetUserId: requesterUserId,
        });
      }

      await this.#dependencies.followRepository.delete(request.id);
    });

    this.#dependencies.logger.log({
      event: SocialFriendLogEvent.REQUEST_REJECTED,
      userId,
      requesterUserId,
    });
  }
}
