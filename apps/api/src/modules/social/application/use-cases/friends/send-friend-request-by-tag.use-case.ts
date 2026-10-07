import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { UserTag } from "../../../domain/value-objects/friends/user-tag.vo.js";
import { type FollowRepositoryPort } from "../../ports/friends/follow.repository.port.js";
import type { SendFriendRequest } from "./send-friend-request.use-case.js";
import { type SendFriendRequestResult } from "./send-friend-request.use-case.js";

export interface SendFriendRequestByTagInput {
  readonly userId: string;
  readonly targetUserTag: string;
}

interface SendFriendRequestByTagDependencies {
  readonly followRepository: Pick<FollowRepositoryPort, "findUserByTag">;
  readonly sendFriendRequest: Pick<SendFriendRequest, "execute">;
}

export class SendFriendRequestByTag {
  readonly #dependencies: SendFriendRequestByTagDependencies;

  constructor(dependencies: SendFriendRequestByTagDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendFriendRequestByTagInput): Promise<SendFriendRequestResult> {
    const targetTag = UserTag.of(input.targetUserTag);
    const targetUser = await this.#dependencies.followRepository.findUserByTag(targetTag.value);
    if (targetUser === null) {
      throw new ApplicationException(ErrorCode.FOLLOW_0905, {
        userTag: input.targetUserTag,
      });
    }

    return this.#dependencies.sendFriendRequest.execute({
      userId: input.userId,
      targetUserId: targetUser.id,
    });
  }
}
