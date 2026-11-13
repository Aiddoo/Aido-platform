import type { NudgeReplyKind } from "@aido/api/vocabulary";

import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { MutualFriendReaderPort } from "#api/modules/social/friends/social-friends.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NudgeId } from "../../domain/nudge-id.vo.js";
import { isNudgeInteractionAvailable } from "../../domain/nudge-interaction.domain-service.js";
import {
  nudgeInteractionClosed,
  nudgeInteractionDisabled,
  nudgeInteractionNotFound,
} from "../nudges.errors.js";
import type { NudgeInteractionConfigPort } from "../ports/nudge-interaction-config.port.js";
import type { NudgeNotifierPort } from "../ports/nudge-notifier.port.js";
import type { NudgeReaderPort } from "../ports/nudge.reader.port.js";
import type { NudgeRepositoryPort } from "../ports/nudge.repository.port.js";
import type { NudgeInteraction } from "../read-models/nudge-interaction.read-model.js";

export interface ReplyToNudgeCommand {
  readonly userId: string;
  readonly nudgeId: number;
  readonly replyKind: NudgeReplyKind;
}

export interface ReplyToNudgeDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly nudgeRepository: Pick<NudgeRepositoryPort, "findById" | "lockInteractionTodo" | "save">;
  readonly nudgeReader: Pick<NudgeReaderPort, "findInteraction">;
  readonly interactionConfig: NudgeInteractionConfigPort;
  readonly mutualFriendReader: Pick<MutualFriendReaderPort, "getCurrentMutualFriendIds">;
  readonly notifier: Pick<NudgeNotifierPort, "recordInteraction">;
  readonly clock: ClockPort;
}

export class ReplyToNudgeUseCase {
  readonly #dependencies: ReplyToNudgeDependencies;

  constructor(dependencies: ReplyToNudgeDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: ReplyToNudgeCommand): Promise<NudgeInteraction> {
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
    const userId = UserId.reconstitute(command.userId);
    const nudgeId = NudgeId.reconstitute(command.nudgeId);

    return unitOfWork.run(async () => {
      const received = await nudgeReader.findInteraction(nudgeId, userId);
      if (received == null || received.receiverId !== command.userId) {
        throw nudgeInteractionNotFound();
      }
      const todo = await nudgeRepository.lockInteractionTodo(
        TodoId.reconstitute(received.todoId),
        userId,
      );
      if (todo == null) {
        throw nudgeInteractionClosed();
      }

      // 할 일 행을 잠근 뒤 다시 읽어야 그사이 바뀐 답장·공개 상태로 판단한다
      const nudge = await nudgeRepository.findById(nudgeId);
      if (nudge == null || !nudge.isReceivedBy(userId)) {
        throw nudgeInteractionNotFound();
      }
      const friendIds = await mutualFriendReader.getCurrentMutualFriendIds(userId);
      const isAvailable = isNudgeInteractionAvailable({
        receiverId: command.userId,
        isMutualFriend: friendIds.includes(nudge.senderId.value),
        todoOwnerId: todo.ownerId,
        todoVisibility: todo.visibility,
      });
      if (!isAvailable) {
        throw nudgeInteractionClosed();
      }

      const isFirstReply = !nudge.hasReplied();
      if (nudge.reply(command.replyKind, clock.now())) {
        await nudgeRepository.save(nudge);
        // 답장을 바꿀 때는 알림을 반복하지 않는다
        if (isFirstReply) {
          await notifier.recordInteraction({
            kind: "reply",
            nudgeId: nudge.id.value,
            todoId: todo.id,
            actorId: command.userId,
            recipientId: nudge.senderId.value,
            actorName: received.receiver.name ?? received.receiver.userTag,
            todoTitle: todo.title,
            replyKind: command.replyKind,
          });
        }
      }

      const replied = await nudgeReader.findInteraction(nudgeId, userId);
      if (replied == null) {
        throw nudgeInteractionNotFound();
      }
      return { ...replied, isAvailable: true };
    });
  }
}
