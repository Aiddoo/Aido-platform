import { ErrorCode } from "@aido/api/errors";

import type { FollowReaderPort } from "#api/modules/social/friends/social-friends.public";
import { ApplicationException } from "#api/shared/application/application.exception";

import { NudgeInteractionPolicy } from "../../domain/nudge-interaction.domain-service.js";
import { type NudgeInteractionConfigPort } from "../ports/nudge-interaction-config.port.js";
import { type NudgeRepositoryPort } from "../ports/nudge.repository.port.js";
import type { NudgeInteractionResult } from "../read-models/nudge-interaction.read-model.js";

export interface GetNudgeInteractionInput {
  readonly userId: string;
  readonly nudgeId: number;
}

interface GetNudgeInteractionDependencies {
  readonly nudgeRepository: Pick<NudgeRepositoryPort, "findInteractionById">;
  readonly nudgeInteractionConfig: NudgeInteractionConfigPort;
  readonly followReader: Pick<FollowReaderPort, "getCurrentMutualFriendIds">;
}

export class GetNudgeInteractionUseCase {
  readonly #dependencies: GetNudgeInteractionDependencies;

  constructor(dependencies: GetNudgeInteractionDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetNudgeInteractionInput): Promise<NudgeInteractionResult> {
    if (!this.#dependencies.nudgeInteractionConfig.isEnabled) {
      throw new ApplicationException(ErrorCode.NUDGE_1105);
    }

    const [nudge, friendIds] = await Promise.all([
      this.#dependencies.nudgeRepository.findInteractionById(input.nudgeId, input.userId),
      this.#dependencies.followReader.getCurrentMutualFriendIds(input.userId),
    ]);
    if (nudge == null) {
      throw new ApplicationException(ErrorCode.NUDGE_1105);
    }
    const friendId = nudge.receiverId === input.userId ? nudge.senderId : nudge.receiverId;

    return {
      ...nudge,
      isAvailable: NudgeInteractionPolicy.isAvailable(nudge, {
        isMutualFriend: friendIds.includes(friendId),
        todoOwnerId: nudge.todo.ownerId,
        todoVisibility: nudge.todo.visibility,
      }),
    };
  }
}
