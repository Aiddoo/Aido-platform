import { chunk } from "es-toolkit";

import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { MutualFriendReaderPort } from "#api/modules/social/friends/social-friends.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NudgeId } from "../../domain/nudge-id.vo.js";
import { judgeNudgeThanks } from "../../domain/nudge-interaction.domain-service.js";
import { NUDGE_THANKS_BATCH_SIZE } from "../../domain/nudges.constants.js";
import {
  nudgeInteractionDisabled,
  nudgeInteractionNotFound,
  nudgeThanksRejected,
  thanksTodoNotFound,
} from "../nudges.errors.js";
import type { NudgeInteractionConfigPort } from "../ports/nudge-interaction-config.port.js";
import type {
  NudgeInteractionNotification,
  NudgeNotifierPort,
} from "../ports/nudge-notifier.port.js";
import type { NudgeReaderPort } from "../ports/nudge.reader.port.js";
import type { NudgeRepositoryPort } from "../ports/nudge.repository.port.js";

export interface SendNudgeThanksCommand {
  readonly userId: string;
  readonly todoId: number;
  readonly throughNudgeId: number;
}

export interface SendNudgeThanksResult {
  readonly sentCount: number;
}

export interface SendNudgeThanksDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly nudgeRepository: Pick<
    NudgeRepositoryPort,
    "listThanksCandidates" | "lockInteractionTodo" | "saveAll"
  >;
  readonly nudgeReader: Pick<NudgeReaderPort, "findInteraction">;
  readonly interactionConfig: NudgeInteractionConfigPort;
  readonly mutualFriendReader: Pick<MutualFriendReaderPort, "getCurrentMutualFriendIds">;
  readonly notifier: Pick<NudgeNotifierPort, "recordInteractions">;
  readonly clock: ClockPort;
}

export class SendNudgeThanksUseCase {
  readonly #dependencies: SendNudgeThanksDependencies;

  constructor(dependencies: SendNudgeThanksDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: SendNudgeThanksCommand): Promise<SendNudgeThanksResult> {
    const {
      unitOfWork,
      nudgeRepository,
      nudgeReader,
      interactionConfig,
      mutualFriendReader,
      notifier,
      clock,
    } = this.#dependencies;
    if (!interactionConfig.isEnabled) {
      throw nudgeInteractionDisabled();
    }
    const ownerId = UserId.reconstitute(command.userId);
    const throughNudgeId = NudgeId.reconstitute(command.throughNudgeId);
    const todoId = TodoId.reconstitute(command.todoId);

    return unitOfWork.run(async () => {
      const todo = await nudgeRepository.lockInteractionTodo(todoId, ownerId);
      if (todo == null) {
        throw thanksTodoNotFound();
      }
      const judgement = judgeNudgeThanks({
        isTodoCompleted: todo.completed,
        todoVisibility: todo.visibility,
      });
      if (!judgement.ok) {
        throw nudgeThanksRejected(judgement.reason);
      }

      const cutoff = await nudgeReader.findInteraction(throughNudgeId, ownerId);
      if (
        cutoff == null ||
        cutoff.receiverId !== command.userId ||
        cutoff.todoId !== command.todoId
      ) {
        throw nudgeInteractionNotFound();
      }
      const friendIds = await mutualFriendReader.getCurrentMutualFriendIds(ownerId);
      const candidates = await nudgeRepository.listThanksCandidates({
        ownerId,
        todoId,
        throughNudgeId,
        friendIds: friendIds.map((friendId) => UserId.reconstitute(friendId)),
      });
      const actorName = cutoff.receiver.name ?? cutoff.receiver.userTag;
      const thankedAt = clock.now();
      let sentCount = 0;

      for (const batch of chunk(candidates, NUDGE_THANKS_BATCH_SIZE)) {
        const thanked = batch.filter((nudge) => nudge.markThanked(thankedAt));
        if (thanked.length === 0) {
          continue;
        }
        await nudgeRepository.saveAll(thanked);
        await notifier.recordInteractions(
          thanked.map<NudgeInteractionNotification>((nudge) => ({
            kind: "thanks",
            nudgeId: nudge.id.value,
            todoId: todo.id,
            actorId: command.userId,
            recipientId: nudge.senderId.value,
            actorName,
            todoTitle: todo.title,
          })),
        );
        sentCount += thanked.length;
      }

      return { sentCount };
    });
  }
}
