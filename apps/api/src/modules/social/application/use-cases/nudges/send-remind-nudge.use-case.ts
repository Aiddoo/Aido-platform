import { ErrorCode } from "@aido/api/errors";

import type { FollowReader } from "#api/modules/social/social-friends.public";
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
import { evaluateRemindNudgeCooldown } from "../../../domain/services/nudges/nudge-cooldown.js";
import { NudgeMessage } from "../../../domain/value-objects/nudges/nudge-message.vo.js";
import { type NudgeNotifierPort } from "../../ports/nudges/nudge-notifier.port.js";
import {
  type NudgeRepositoryPort,
  type ReminderNudgeWithRelations,
} from "../../ports/nudges/nudge.repository.port.js";

export interface SendRemindNudgeInput {
  senderId: string;
  receiverId: string;
  message?: string;
}

/**
 * 리마인드 콕 찌르기 보내기 use-case.
 *
 * 친구가 오늘 할 일을 만들지 않았을 때 독촉한다. 자기 자신 체크 → 친구 관계 확인 후,
 * 트랜잭션 안에서 수신자의 오늘 할 일 부재·쿨다운(동일 친구 1시간, 일일 제한 없음)을 검사하고
 * 생성한다. 생성 후 알림을 enqueue한다(특정 할 일에 묶이지 않으므로 todoId·todoTitle 없이).
 */
interface SendRemindNudgeDependencies {
  readonly nudgeRepository: NudgeRepositoryPort;
  readonly notifier: NudgeNotifierPort;
  readonly mutationLock: MutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly followReader: FollowReader;
  readonly logger: ApplicationLogger;
}

export class SendRemindNudge {
  readonly #dependencies: SendRemindNudgeDependencies;

  constructor(dependencies: SendRemindNudgeDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    input: SendRemindNudgeInput,
    tz: string = "UTC",
  ): Promise<ReminderNudgeWithRelations> {
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
    const today = startOfDayInTimezone(capturedAt, tz);

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
      if (lastRemind) {
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

    this.#dependencies.logger.log(
      `Remind nudge sent: senderId=${senderId}, receiverId=${receiverId}`,
    );

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
