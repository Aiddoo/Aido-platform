import type { FollowReaderPort } from "#api/modules/social/friends/social-friends.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { dailySendWindowAt } from "../../../shared/domain/daily-send-window.domain-service.js";
import { evaluateRemindNudgeCooldown } from "../../domain/nudge-cooldown.domain-service.js";
import { NudgeMessage } from "../../domain/nudge-message.vo.js";
import { ReminderNudge } from "../../domain/reminder-nudge.aggregate.js";
import {
  cannotNudgeSelf,
  nudgeTargetNotFriend,
  remindNudgeCooldownActive,
  remindTargetHasTodayTodos,
} from "../nudges.errors.js";
import { NudgeLockKeys } from "../nudges.lock-keys.js";
import { NudgeLogEvent } from "../nudges.log-events.js";
import type { NudgeNotifierPort } from "../ports/nudge-notifier.port.js";
import type { NudgeRepositoryPort } from "../ports/nudge.repository.port.js";

export interface SendRemindNudgeCommand {
  readonly senderId: string;
  readonly receiverId: string;
  readonly message?: string;
  readonly timezone: string;
}

export interface SendRemindNudgeDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly nudgeRepository: Pick<
    NudgeRepositoryPort,
    "countTodosOn" | "findLastReminderSentTo" | "nextReminderId" | "saveReminder"
  >;
  readonly followReader: Pick<FollowReaderPort, "isMutualFriend" | "getUserDisplayName">;
  readonly notifier: Pick<NudgeNotifierPort, "notifyNudgeSent">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class SendRemindNudgeUseCase {
  readonly #dependencies: SendRemindNudgeDependencies;

  constructor(dependencies: SendRemindNudgeDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: SendRemindNudgeCommand): Promise<ReminderNudge> {
    const { unitOfWork, mutationLock, nudgeRepository, followReader, notifier, clock, logger } =
      this.#dependencies;
    const senderId = UserId.reconstitute(command.senderId);
    const receiverId = UserId.reconstitute(command.receiverId);

    if (senderId.equals(receiverId)) {
      throw cannotNudgeSelf();
    }
    if (!(await followReader.isMutualFriend(senderId, receiverId))) {
      throw nudgeTargetNotFriend(receiverId);
    }
    const message = command.message == null ? null : NudgeMessage.create(command.message);
    // 친구의 "오늘"도 보낸 사람이 요청한 시간대로 본다
    const requestedAt = clock.now();
    const today = dailySendWindowAt({ now: requestedAt, timeZone: command.timezone }).localDate;

    const reminder = await unitOfWork.run(async () => {
      await mutationLock.acquire([NudgeLockKeys.remindCooldown(senderId, receiverId)]);

      if ((await nudgeRepository.countTodosOn(receiverId, today)) > 0) {
        throw remindTargetHasTodayTodos(receiverId);
      }

      const lastReminder = await nudgeRepository.findLastReminderSentTo(senderId, receiverId);
      const cooldown = evaluateRemindNudgeCooldown({
        lastSentAt: lastReminder?.createdAt ?? null,
        now: clock.now(),
      });
      if (cooldown.isActive) {
        throw remindNudgeCooldownActive(receiverId, cooldown.remainingSeconds);
      }

      const created = ReminderNudge.create({
        id: await nudgeRepository.nextReminderId(),
        senderId,
        receiverId,
        message,
        now: requestedAt,
      });
      await nudgeRepository.saveReminder(created);
      await notifier.notifyNudgeSent({
        nudgeId: created.id.value,
        senderId: senderId.value,
        receiverId: receiverId.value,
        senderName: await followReader.getUserDisplayName(senderId),
        message: message?.value,
      });
      return created;
    });

    logger.log({
      event: NudgeLogEvent.REMINDER_SENT,
      nudgeId: reminder.id.value,
      senderId: senderId.value,
      receiverId: receiverId.value,
    });
    return reminder;
  }
}
