import { ErrorCode } from "@aido/api/errors";

import { FriendLockKeys } from "#api/modules/social/friends/application/friends.lock-keys";
import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { type MutationLockPort, type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { FriendLogEvent } from "../friends.log-events.js";
import { type FollowRepositoryPort } from "../ports/follow.repository.port.js";

export interface RejectFriendRequestInput {
  readonly userId: string;
  readonly requesterUserId: string;
}

interface RejectFriendRequestDependencies {
  readonly followRepository: Pick<FollowRepositoryPort, "findByFollowerAndFollowing" | "delete">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly logger: ApplicationLoggerPort;
}

export class RejectFriendRequestUseCase {
  readonly #dependencies: RejectFriendRequestDependencies;

  constructor(dependencies: RejectFriendRequestDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RejectFriendRequestInput): Promise<void> {
    const { userId, requesterUserId } = input;

    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        FriendLockKeys.pair(UserId.reconstitute(userId), UserId.reconstitute(requesterUserId)),
      ]);
      const request = await this.#dependencies.followRepository.findByFollowerAndFollowing(
        requesterUserId,
        userId,
      );
      if (request == null || !request.isPending()) {
        throw new ApplicationException(ErrorCode.FOLLOW_0903, {
          targetUserId: requesterUserId,
        });
      }

      await this.#dependencies.followRepository.delete(request.id);
    });

    this.#dependencies.logger.log({
      event: FriendLogEvent.REQUEST_REJECTED,
      userId,
      requesterUserId,
    });
  }
}
