import { ErrorCode } from "@aido/api/errors";
import type { NudgeReplyKind } from "@aido/api/vocabulary";
import { Inject, Injectable } from "@nestjs/common";

import { FollowReader } from "#api/follow/index";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { Nudge } from "../../../domain/entities/nudge.aggregate.js";
import { NudgeInteractionPolicy } from "../../../domain/policies/nudge-interaction.policy.js";
import type { NudgeInteractionResult } from "../../nudge-interaction.types.js";
import {
  NUDGE_INTERACTION_CONFIG,
  type NudgeInteractionConfigPort,
} from "../../ports/nudge-interaction.config.port.js";
import { NUDGE_NOTIFIER, type NudgeNotifierPort } from "../../ports/nudge-notifier.port.js";
import { NUDGE_REPOSITORY, type NudgeRepositoryPort } from "../../ports/nudge.repository.port.js";

export interface ReplyToNudgeInput {
  readonly userId: string;
  readonly nudgeId: number;
  readonly replyKind: NudgeReplyKind;
}

@Injectable()
export class ReplyToNudgeUseCase {
  constructor(
    @Inject(NUDGE_REPOSITORY)
    private readonly nudgeRepository: NudgeRepositoryPort,
    @Inject(NUDGE_INTERACTION_CONFIG)
    private readonly nudgeInteractionConfig: NudgeInteractionConfigPort,
    @Inject(NUDGE_NOTIFIER)
    private readonly nudgeNotifier: NudgeNotifierPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly followReader: FollowReader,
  ) {}

  async execute(input: ReplyToNudgeInput): Promise<NudgeInteractionResult> {
    if (!this.nudgeInteractionConfig.isEnabled) {
      throw new ApplicationException(ErrorCode.NUDGE_1105);
    }

    return this.unitOfWork.run(async () => {
      const existingNudge = await this.nudgeRepository.findInteractionById(
        input.nudgeId,
        input.userId,
      );
      if (!existingNudge || existingNudge.receiverId !== input.userId) {
        throw new ApplicationException(ErrorCode.NUDGE_1105);
      }

      const todo = await this.nudgeRepository.lockInteractionTodo(
        existingNudge.todoId,
        input.userId,
      );
      if (!todo) {
        throw new ApplicationException(ErrorCode.NUDGE_1109);
      }
      const record = await this.nudgeRepository.findInteractionById(input.nudgeId, input.userId);
      if (!record || record.receiverId !== input.userId) {
        throw new ApplicationException(ErrorCode.NUDGE_1105);
      }
      const friendIds = await this.followReader.getCurrentMutualFriendIds(input.userId);
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
      await this.nudgeRepository.saveReply(nudge);
      if (isFirstReply) {
        await this.nudgeNotifier.recordInteraction({
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

      const updatedNudge = await this.nudgeRepository.findInteractionById(nudge.id, input.userId);
      if (!updatedNudge) {
        throw new ApplicationException(ErrorCode.NUDGE_1105);
      }
      return { ...updatedNudge, isAvailable: true };
    });
  }
}
