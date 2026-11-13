import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { friendRequestNotFound } from "../friends.errors.js";
import { FriendLockKeys } from "../friends.lock-keys.js";
import { FriendLogEvent } from "../friends.log-events.js";
import type { FriendshipRepositoryPort } from "../ports/friendship.repository.port.js";

export interface RejectFriendRequestCommand {
  readonly userId: string;
  readonly requesterUserId: string;
}

export interface RejectFriendRequestDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly friendshipRepository: Pick<
    FriendshipRepositoryPort,
    "findByFollowerAndFollowing" | "delete"
  >;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class RejectFriendRequestUseCase {
  readonly #dependencies: RejectFriendRequestDependencies;

  constructor(dependencies: RejectFriendRequestDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: RejectFriendRequestCommand): Promise<void> {
    const { unitOfWork, mutationLock, friendshipRepository, logger } = this.#dependencies;
    const userId = UserId.reconstitute(command.userId);
    const requesterUserId = UserId.reconstitute(command.requesterUserId);

    await unitOfWork.run(async () => {
      await mutationLock.acquire([FriendLockKeys.pair(userId, requesterUserId)]);
      const request = await friendshipRepository.findByFollowerAndFollowing(
        requesterUserId,
        userId,
      );
      if (request == null || !request.isPending()) {
        throw friendRequestNotFound(requesterUserId);
      }
      await friendshipRepository.delete(request);
    });

    logger.log({
      event: FriendLogEvent.REQUEST_REJECTED,
      userId: command.userId,
      requesterUserId: command.requesterUserId,
    });
  }
}
