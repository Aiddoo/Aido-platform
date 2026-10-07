import { ErrorCode } from "@aido/api/errors";

import type { FollowReaderPort } from "#api/modules/social/social-friends.public";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { NudgeInteractionPolicy } from "../../../domain/policies/nudges/nudge-interaction.policy.js";
import type { NudgeInteractionResult } from "../../models/nudges/nudge-interaction.models.js";
import { type NudgeInteractionConfigPort } from "../../ports/nudges/nudge-interaction.config.port.js";
import { type NudgeRepositoryPort } from "../../ports/nudges/nudge.repository.port.js";

export interface GetNudgeInteractionInput {
  readonly userId: string;
  readonly nudgeId: number;
}

interface GetNudgeInteractionDependencies {
  readonly nudgeRepository: Pick<NudgeRepositoryPort, "findInteractionById">;
  readonly nudgeInteractionConfig: NudgeInteractionConfigPort;
  readonly followReader: Pick<FollowReaderPort, "getCurrentMutualFriendIds">;
}

export class GetNudgeInteraction {
  readonly #dependencies: GetNudgeInteractionDependencies;

  constructor(dependencies: GetNudgeInteractionDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetNudgeInteractionInput): Promise<NudgeInteractionResult> {
    if (!this.#dependencies.nudgeInteractionConfig.isEnabled) {
      throw new ApplicationException(ErrorCode.NUDGE_1105);
    }

    const nudge = await this.#dependencies.nudgeRepository.findInteractionById(
      input.nudgeId,
      input.userId,
    );
    if (nudge === null) {
      throw new ApplicationException(ErrorCode.NUDGE_1105);
    }
    const friendIds = await this.#dependencies.followReader.getCurrentMutualFriendIds(input.userId);
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
