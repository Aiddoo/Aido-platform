import { ErrorCode } from "@aido/api/errors";

import type { FollowReaderPort } from "#api/modules/social/social-friends.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import { startOfDayInTimezone } from "#api/shared/domain/date/utils/timezone";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { ReminderNudge } from "../../../domain/aggregates/nudges/reminder-nudge.aggregate.js";
import { evaluateRemindNudgeCooldown } from "../../../domain/policies/nudges/nudge-cooldown.policy.js";
import { NudgeMessage } from "../../../domain/value-objects/nudges/nudge-message.vo.js";
import { NudgeLogEvent } from "../../observability/nudges/nudge-log.events.js";
import { type NudgeNotifierPort } from "../../ports/nudges/nudge-notifier.port.js";
import {
  type NudgeRepositoryPort,
  type ReminderNudgeWithRelations,
} from "../../ports/nudges/nudge.repository.port.js";

export interface SendRemindNudgeInput {
  readonly senderId: string;
  readonly receiverId: string;
  readonly message?: string;
  readonly timezone: string;
}

interface SendRemindNudgeDependencies {
  readonly nudgeRepository: Pick<
    NudgeRepositoryPort,
    "countTodayTodos" | "createRemindNudge" | "findLastRemindNudge"
  >;
  readonly notifier: Pick<NudgeNotifierPort, "notifyNudgeSent">;
  readonly mutationLock: MutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly followReader: Pick<FollowReaderPort, "isMutualFriend">;
  readonly logger: ApplicationLogger;
}

export class SendRemindNudge {
  readonly #dependencies: SendRemindNudgeDependencies;

  constructor(dependencies: SendRemindNudgeDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendRemindNudgeInput): Promise<ReminderNudgeWithRelations> {
    const { senderId, receiverId, message } = input;

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
    const today = startOfDayInTimezone(capturedAt, input.timezone);

    const remindNudge = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        MutationLockKeys.remindNudgeCooldown(senderId, receiverId),
      ]);

      const todayTodoCount = await this.#dependencies.nudgeRepository.countTodayTodos(
        receiverId,
        today,
      );
      if (todayTodoCount > 0) {
        throw new ApplicationException(ErrorCode.NUDGE_1107, { receiverId });
      }

      const lastRemind = await this.#dependencies.nudgeRepository.findLastRemindNudge(
        senderId,
        receiverId,
      );
      if (lastRemind !== null) {
        const cooldown = evaluateRemindNudgeCooldown(lastRemind.createdAt);
        if (cooldown.isActive) {
          throw new ApplicationException(ErrorCode.NUDGE_1108, {
            targetUserId: receiverId,
            remainingSeconds: cooldown.remainingSeconds,
          });
        }
      }

      return this.#dependencies.nudgeRepository.createRemindNudge(
        ReminderNudge.planCreation({
          senderId,
          receiverId,
          message: nudgeMessage.raw,
        }),
      );
    });

    this.#dependencies.logger.log({
      event: NudgeLogEvent.REMINDER_SENT,
      nudgeId: remindNudge.id,
      senderId,
      receiverId,
    });

    const senderName = remindNudge.sender.profile?.name ?? remindNudge.sender.userTag;
    this.#dependencies.notifier.notifyNudgeSent({
      nudgeId: remindNudge.id,
      senderId,
      receiverId,
      senderName,
      message: nudgeMessage.raw,
    });

    return remindNudge;
  }
}
