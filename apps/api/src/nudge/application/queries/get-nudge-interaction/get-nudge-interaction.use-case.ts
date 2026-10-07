import { ErrorCode } from "@aido/api/errors";
import { Inject, Injectable } from "@nestjs/common";

import { FollowReader } from "#api/follow/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { NudgeInteractionPolicy } from "../../../domain/policies/nudge-interaction.policy.js";
import type { NudgeInteractionResult } from "../../nudge-interaction.types.js";
import {
  NUDGE_INTERACTION_CONFIG,
  type NudgeInteractionConfigPort,
} from "../../ports/nudge-interaction.config.port.js";
import { NUDGE_REPOSITORY, type NudgeRepositoryPort } from "../../ports/nudge.repository.port.js";

export interface GetNudgeInteractionInput {
  readonly userId: string;
  readonly nudgeId: number;
}

@Injectable()
export class GetNudgeInteractionUseCase {
  constructor(
    @Inject(NUDGE_REPOSITORY)
    private readonly nudgeRepository: NudgeRepositoryPort,
    @Inject(NUDGE_INTERACTION_CONFIG)
    private readonly nudgeInteractionConfig: NudgeInteractionConfigPort,
    private readonly followReader: FollowReader,
  ) {}

  async execute(input: GetNudgeInteractionInput): Promise<NudgeInteractionResult> {
    if (!this.nudgeInteractionConfig.isEnabled) {
      throw new ApplicationException(ErrorCode.NUDGE_1105);
    }

    const nudge = await this.nudgeRepository.findInteractionById(input.nudgeId, input.userId);
    if (!nudge) {
      throw new ApplicationException(ErrorCode.NUDGE_1105);
    }
    const friendIds = await this.followReader.getCurrentMutualFriendIds(input.userId);
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
