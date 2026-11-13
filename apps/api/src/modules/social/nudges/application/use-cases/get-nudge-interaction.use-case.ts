import type { FollowReaderPort } from "#api/modules/social/friends/social-friends.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NudgeId } from "../../domain/nudge-id.vo.js";
import { isNudgeInteractionAvailable } from "../../domain/nudge-interaction.domain-service.js";
import { nudgeInteractionDisabled, nudgeInteractionNotFound } from "../nudges.errors.js";
import type { NudgeInteractionConfigPort } from "../ports/nudge-interaction-config.port.js";
import type { NudgeReaderPort } from "../ports/nudge.reader.port.js";
import type { NudgeInteraction } from "../read-models/nudge-interaction.read-model.js";

export interface GetNudgeInteractionQuery {
  readonly userId: string;
  readonly nudgeId: number;
}

export interface GetNudgeInteractionDependencies {
  readonly nudgeReader: Pick<NudgeReaderPort, "findInteraction">;
  readonly interactionConfig: NudgeInteractionConfigPort;
  readonly followReader: Pick<FollowReaderPort, "getCurrentMutualFriendIds">;
}

export class GetNudgeInteractionUseCase {
  readonly #dependencies: GetNudgeInteractionDependencies;

  constructor(dependencies: GetNudgeInteractionDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetNudgeInteractionQuery): Promise<NudgeInteraction> {
    const { nudgeReader, interactionConfig, followReader } = this.#dependencies;
    if (!interactionConfig.isEnabled) {
      throw nudgeInteractionDisabled();
    }

    const viewerId = UserId.reconstitute(query.userId);
    const [nudge, friendIds] = await Promise.all([
      nudgeReader.findInteraction(NudgeId.reconstitute(query.nudgeId), viewerId),
      followReader.getCurrentMutualFriendIds(viewerId),
    ]);
    if (nudge == null) {
      throw nudgeInteractionNotFound();
    }
    const counterpartId = nudge.receiverId === query.userId ? nudge.senderId : nudge.receiverId;
    return {
      ...nudge,
      isAvailable: isNudgeInteractionAvailable({
        receiverId: nudge.receiverId,
        isMutualFriend: friendIds.includes(counterpartId),
        todoOwnerId: nudge.todo.ownerId,
        todoVisibility: nudge.todo.visibility,
      }),
    };
  }
}
