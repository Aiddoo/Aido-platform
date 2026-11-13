import type { MutualFriendReaderPort } from "#api/modules/social/friends/social-friends.public";
import { clampPageSize, type CursorPage, toCursorPage } from "#api/shared/application/cursor-page";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NudgeId } from "../../domain/nudge-id.vo.js";
import { isNudgeInteractionAvailable } from "../../domain/nudge-interaction.domain-service.js";
import type { NudgeDirection } from "../../domain/nudges.constants.js";
import { nudgeInteractionDisabled } from "../nudges.errors.js";
import type { NudgeInteractionConfigPort } from "../ports/nudge-interaction-config.port.js";
import type { NudgeReaderPort } from "../ports/nudge.reader.port.js";
import type { NudgeInteractionReadModel } from "../read-models/nudge-interaction.read-model.js";

export interface GetNudgeInteractionsQuery {
  readonly userId: string;
  readonly direction: NudgeDirection;
  readonly cursor?: number;
  readonly size?: number;
}

export interface GetNudgeInteractionsDependencies {
  readonly nudgeReader: Pick<NudgeReaderPort, "listInteractions">;
  readonly interactionConfig: NudgeInteractionConfigPort;
  readonly mutualFriendReader: Pick<MutualFriendReaderPort, "getCurrentMutualFriendIds">;
}

export class GetNudgeInteractionsUseCase {
  readonly #dependencies: GetNudgeInteractionsDependencies;

  constructor(dependencies: GetNudgeInteractionsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    query: GetNudgeInteractionsQuery,
  ): Promise<CursorPage<NudgeInteractionReadModel, number>> {
    const { nudgeReader, interactionConfig, mutualFriendReader } = this.#dependencies;
    if (!interactionConfig.isEnabled) {
      throw nudgeInteractionDisabled();
    }

    const size = clampPageSize(query.size);
    const viewerId = UserId.reconstitute(query.userId);
    const [rows, friendIds] = await Promise.all([
      nudgeReader.listInteractions({
        viewerId,
        direction: query.direction,
        afterNudgeId: query.cursor == null ? null : NudgeId.reconstitute(query.cursor),
        limit: size + 1,
      }),
      mutualFriendReader.getCurrentMutualFriendIds(viewerId),
    ]);
    const friends = new Set(friendIds);
    const page = toCursorPage({ rows, size, toCursor: (nudge) => nudge.id });

    return {
      ...page,
      items: page.items.map((nudge) => ({
        ...nudge,
        isAvailable: isNudgeInteractionAvailable({
          receiverId: nudge.receiverId,
          isMutualFriend: friends.has(
            query.direction === "received" ? nudge.senderId : nudge.receiverId,
          ),
          todoOwnerId: nudge.todo.ownerId,
          todoVisibility: nudge.todo.visibility,
        }),
      })),
    };
  }
}
