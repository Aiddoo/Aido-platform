import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { UserTag } from "../../../domain/value-objects/friends/user-tag.vo.js";
import { type FollowRepositoryPort } from "../../ports/friends/follow.repository.port.js";
import type { SendFriendRequest } from "./send-friend-request.use-case.js";
import { type SendFriendRequestResult } from "./send-friend-request.use-case.js";

export interface SendFriendRequestByTagInput {
  userId: string;
  targetUserTag: string;
}

/**
 * userTag로 친구 요청 보내기 use-case.
 * 태그를 사용자 ID로 해석한 뒤 SendFriendRequestUseCase에 위임한다.
 */
interface SendFriendRequestByTagDependencies {
  readonly followRepository: FollowRepositoryPort;
  readonly sendFriendRequest: SendFriendRequest;
}

export class SendFriendRequestByTag {
  readonly #dependencies: SendFriendRequestByTagDependencies;

  constructor(dependencies: SendFriendRequestByTagDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendFriendRequestByTagInput): Promise<SendFriendRequestResult> {
    const targetTag = UserTag.of(input.targetUserTag);
    const targetUser = await this.#dependencies.followRepository.findUserByTag(targetTag.value);
    if (!targetUser) {
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
