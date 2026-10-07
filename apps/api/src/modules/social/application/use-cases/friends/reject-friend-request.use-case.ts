import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { type FollowRepositoryPort } from "../../ports/friends/follow.repository.port.js";

export interface RejectFriendRequestInput {
  userId: string;
  requesterUserId: string;
}

interface RejectFriendRequestDependencies {
  readonly followRepository: FollowRepositoryPort;
  readonly logger: ApplicationLogger;
}

export class RejectFriendRequest {
  readonly #dependencies: RejectFriendRequestDependencies;

  constructor(dependencies: RejectFriendRequestDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RejectFriendRequestInput): Promise<void> {
    const { userId, requesterUserId } = input;

    const request = await this.#dependencies.followRepository.findByFollowerAndFollowing(
      requesterUserId,
      userId,
    );
    if (!request?.isPending()) {
      throw new ApplicationException(ErrorCode.FOLLOW_0903, {
        targetUserId: requesterUserId,
      });
    }

    await this.#dependencies.followRepository.delete(request.id);

    this.#dependencies.logger.log(`Friend request rejected: ${requesterUserId} -> ${userId}`);
  }
}
