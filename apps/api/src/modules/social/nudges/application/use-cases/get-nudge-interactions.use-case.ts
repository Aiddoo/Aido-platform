import { ErrorCode } from "@aido/api/errors";

import type { FollowReaderPort } from "#api/modules/social/friends/social-friends.public";
import { ApplicationException } from "#api/shared/application/application.exception";
import type { PaginationService } from "#api/shared/application/pagination/index";
import { type CursorPaginatedResponse } from "#api/shared/application/pagination/index";

import { NudgeInteractionPolicy } from "../../domain/nudge-interaction.domain-service.js";
import { type NudgeInteractionConfigPort } from "../ports/nudge-interaction-config.port.js";
import {
  type NudgeInteractionRecord,
  type NudgeRepositoryPort,
} from "../ports/nudge.repository.port.js";
import type { NudgeInteractionResult } from "../read-models/nudge-interaction.read-model.js";

export interface GetNudgeInteractionsInput {
  readonly userId: string;
  readonly direction: "received" | "sent";
  readonly cursor?: number;
  readonly size: number;
}

interface GetNudgeInteractionsDependencies {
  readonly nudgeRepository: Pick<NudgeRepositoryPort, "findInteractions">;
  readonly nudgeInteractionConfig: NudgeInteractionConfigPort;
  readonly followReader: Pick<FollowReaderPort, "getCurrentMutualFriendIds">;
  readonly paginationService: PaginationService;
}

export class GetNudgeInteractions {
  readonly #dependencies: GetNudgeInteractionsDependencies;

  constructor(dependencies: GetNudgeInteractionsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    input: GetNudgeInteractionsInput,
  ): Promise<CursorPaginatedResponse<NudgeInteractionResult, number>> {
    if (!this.#dependencies.nudgeInteractionConfig.isEnabled) {
      throw new ApplicationException(ErrorCode.NUDGE_1105);
    }

    const [nudges, friendIds] = await Promise.all([
      this.#dependencies.nudgeRepository.findInteractions(input),
      this.#dependencies.followReader.getCurrentMutualFriendIds(input.userId),
    ]);
    const friends = new Set(friendIds);
    const page = this.#dependencies.paginationService.createCursorPaginatedResponse<
      NudgeInteractionRecord,
      number
    >({
      items: nudges,
      size: input.size,
    });

    return {
      ...page,
      items: page.items.map((nudge) => ({
        ...nudge,
        isAvailable: NudgeInteractionPolicy.isAvailable(nudge, {
          isMutualFriend: friends.has(
            input.direction === "received" ? nudge.senderId : nudge.receiverId,
          ),
          todoOwnerId: nudge.todo.ownerId,
          todoVisibility: nudge.todo.visibility,
        }),
      })),
    };
  }
}
