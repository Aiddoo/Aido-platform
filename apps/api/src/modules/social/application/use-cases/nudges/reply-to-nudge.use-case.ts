import { ErrorCode } from "@aido/api/errors";
import type { NudgeReplyKind } from "@aido/api/vocabulary";

import type { FollowReader } from "#api/modules/social/social-friends.public";
import { type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { Nudge } from "../../../domain/aggregates/nudges/nudge.aggregate.js";
import { NudgeInteractionPolicy } from "../../../domain/policies/nudges/nudge-interaction.policy.js";
import { type NudgeInteractionConfigPort } from "../../ports/nudges/nudge-interaction.config.port.js";
import { type NudgeNotifierPort } from "../../ports/nudges/nudge-notifier.port.js";
import { type NudgeRepositoryPort } from "../../ports/nudges/nudge.repository.port.js";
import type { NudgeInteractionResult } from "../../services/nudges/nudge-interaction.types.js";

export interface ReplyToNudgeInput {
  readonly userId: string;
  readonly nudgeId: number;
  readonly replyKind: NudgeReplyKind;
}

interface ReplyToNudgeDependencies {
  readonly nudgeRepository: NudgeRepositoryPort;
  readonly nudgeInteractionConfig: NudgeInteractionConfigPort;
  readonly nudgeNotifier: NudgeNotifierPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly followReader: FollowReader;
}

export class ReplyToNudge {
  readonly #dependencies: ReplyToNudgeDependencies;

  constructor(dependencies: ReplyToNudgeDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ReplyToNudgeInput): Promise<NudgeInteractionResult> {
    if (!this.#dependencies.nudgeInteractionConfig.isEnabled) {
      throw new ApplicationException(ErrorCode.NUDGE_1105);
    }

    return this.#dependencies.unitOfWork.run(async () => {
      const existingNudge = await this.#dependencies.nudgeRepository.findInteractionById(
        input.nudgeId,
        input.userId,
      );
      if (!existingNudge || existingNudge.receiverId !== input.userId) {
        throw new ApplicationException(ErrorCode.NUDGE_1105);
      }

      const todo = await this.#dependencies.nudgeRepository.lockInteractionTodo(
        existingNudge.todoId,
        input.userId,
      );
      if (!todo) {
        throw new ApplicationException(ErrorCode.NUDGE_1109);
      }
      const record = await this.#dependencies.nudgeRepository.findInteractionById(
        input.nudgeId,
        input.userId,
      );
      if (!record || record.receiverId !== input.userId) {
        throw new ApplicationException(ErrorCode.NUDGE_1105);
      }
      const friendIds = await this.#dependencies.followReader.getCurrentMutualFriendIds(
        input.userId,
      );
      if (
        !NudgeInteractionPolicy.isAvailable(record, {
          isMutualFriend: friendIds.includes(record.senderId),
          todoOwnerId: todo.ownerId,
          todoVisibility: todo.visibility,
        })
      ) {
        throw new ApplicationException(ErrorCode.NUDGE_1109);
      }

      const nudge = Nudge.reconstitute(record);
      const isFirstReply = !nudge.hasReplied();
      if (!nudge.reply(input.replyKind, now())) {
        return { ...record, isAvailable: true };
      }
      await this.#dependencies.nudgeRepository.saveReply(nudge);
      if (isFirstReply) {
        await this.#dependencies.nudgeNotifier.recordInteraction({
          kind: "reply",
          nudgeId: nudge.id,
          todoId: todo.id,
          actorId: input.userId,
          recipientId: nudge.senderId,
          actorName: record.receiver.profile?.name ?? record.receiver.userTag,
          todoTitle: todo.title,
          replyKind: input.replyKind,
        });
      }

      const updatedNudge = await this.#dependencies.nudgeRepository.findInteractionById(
        nudge.id,
        input.userId,
      );
      if (!updatedNudge) {
        throw new ApplicationException(ErrorCode.NUDGE_1105);
      }
      return { ...updatedNudge, isAvailable: true };
    });
  }
}
