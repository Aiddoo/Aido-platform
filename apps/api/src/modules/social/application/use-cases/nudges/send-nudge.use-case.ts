import { ErrorCode } from "@aido/api/errors";

import type { FollowReaderPort } from "#api/modules/social/social-friends.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import { dayWindowInTimezone } from "#api/shared/domain/date/utils/timezone";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { Nudge } from "../../../domain/aggregates/nudges/nudge.aggregate.js";
import { evaluateNudgeCooldown } from "../../../domain/policies/nudges/nudge-cooldown.policy.js";
import { NudgeMessage } from "../../../domain/value-objects/nudges/nudge-message.vo.js";
import { NudgeTargetTodo } from "../../../domain/value-objects/nudges/nudge-target-todo.vo.js";
import { NudgeLogEvent } from "../../observability/nudges/nudge-log.events.js";
import { type NudgeLimitReaderPort } from "../../ports/nudges/nudge-limit-reader.port.js";
import { type NudgeNotifierPort } from "../../ports/nudges/nudge-notifier.port.js";
import {
  type NudgeRepositoryPort,
  type NudgeWithRelations,
} from "../../ports/nudges/nudge.repository.port.js";

export interface SendNudgeInput {
  readonly senderId: string;
  readonly receiverId: string;
  readonly todoId: number;
  readonly message?: string;
  readonly timezone: string;
}

interface SendNudgeDependencies {
  readonly nudgeRepository: Pick<
    NudgeRepositoryPort,
    "countSentSince" | "createNudge" | "findLastNudgeForTodo" | "findTargetTodo"
  >;
  readonly notifier: Pick<NudgeNotifierPort, "notifyNudgeSent">;
  readonly limitReader: NudgeLimitReaderPort;
  readonly mutationLock: MutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly followReader: Pick<FollowReaderPort, "isMutualFriend">;
  readonly logger: ApplicationLogger;
}

export class SendNudge {
  readonly #dependencies: SendNudgeDependencies;

  constructor(dependencies: SendNudgeDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendNudgeInput): Promise<NudgeWithRelations> {
    const { senderId, receiverId, todoId, message } = input;

    if (senderId === receiverId) {
      throw new ApplicationException(ErrorCode.NUDGE_1104);
    }

    const isFriend = await this.#dependencies.followReader.isMutualFriend(senderId, receiverId);
    if (!isFriend) {
      throw new ApplicationException(ErrorCode.NUDGE_1103, {
        targetUserId: receiverId,
      });
    }

    const nudgeMessage = NudgeMessage.of(message);
    const capturedAt = now();
    const quotaWindow = dayWindowInTimezone(capturedAt, input.timezone);

    const nudge = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        MutationLockKeys.nudgeDailyQuota(senderId),
        MutationLockKeys.nudgeCooldown(senderId, todoId),
      ]);

      const todoRow = await this.#dependencies.nudgeRepository.findTargetTodo(todoId);
      if (todoRow === null) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
      }

      const target = NudgeTargetTodo.of(todoRow);
      if (!target.isOwnedBy(receiverId)) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
      }
      if (!target.isPublic()) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
      }

      if (!target.isActiveOn(quotaWindow.date)) {
        throw new ApplicationException(ErrorCode.NUDGE_1106, { todoId });
      }

      const dailyLimit = await this.#dependencies.limitReader.getDailyLimitInTx(senderId);
      const used = await this.#dependencies.nudgeRepository.countSentSince(
        senderId,
        quotaWindow.startsAt,
        quotaWindow.endsAt,
      );
      if (dailyLimit !== null && used >= dailyLimit) {
        throw new ApplicationException(ErrorCode.NUDGE_1101, {
          limit: dailyLimit,
        });
      }

      const lastNudge = await this.#dependencies.nudgeRepository.findLastNudgeForTodo(
        senderId,
        todoId,
      );
      if (lastNudge !== null) {
        const cooldown = evaluateNudgeCooldown(lastNudge.createdAt);
        if (cooldown.isActive) {
          throw new ApplicationException(ErrorCode.NUDGE_1102, {
            targetUserId: receiverId,
            remainingSeconds: cooldown.remainingSeconds,
          });
        }
      }

      return this.#dependencies.nudgeRepository.createNudge(
        Nudge.planCreation({
          senderId,
          receiverId,
          todoId,
          message: nudgeMessage.raw,
          createdAt: capturedAt,
        }),
      );
    });

    this.#dependencies.logger.log({
      event: NudgeLogEvent.SENT,
      nudgeId: nudge.id,
      todoId,
      senderId,
      receiverId,
    });

    const senderName = nudge.sender.profile?.name ?? nudge.sender.userTag;
    this.#dependencies.notifier.notifyNudgeSent({
      nudgeId: nudge.id,
      senderId,
      receiverId,
      senderName,
      todoId,
      todoTitle: nudge.todo.title,
      message: nudgeMessage.raw,
    });

    return nudge;
  }
}
