import type { MutualFriendReaderPort } from "#api/modules/social/friends/social-friends.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { dailySendWindowAt } from "../../../shared/domain/daily-send-window.domain-service.js";
import { NudgeMessage } from "../../../shared/domain/nudge-message.vo.js";
import { cannotNudgeSelf } from "../../../shared/domain/social.errors.js";
import { evaluateReminderNudgeCooldown } from "../../domain/reminder-nudge-cooldown.domain-service.js";
import { ReminderNudge } from "../../domain/reminder-nudge.aggregate.js";
import type { ReminderNudgeNotifierPort } from "../ports/reminder-nudge-notifier.port.js";
import type { ReminderNudgeRepositoryPort } from "../ports/reminder-nudge.repository.port.js";
import type { ReminderTargetReaderPort } from "../ports/reminder-target.reader.port.js";
import {
  reminderNudgeCooldownActive,
  reminderTargetHasTodayTodos,
  reminderTargetNotFriend,
} from "../reminder-nudges.errors.js";
import { ReminderNudgeLockKeys } from "../reminder-nudges.lock-keys.js";
import { ReminderNudgeLogEvent } from "../reminder-nudges.log-events.js";

export interface SendReminderNudgeCommand {
  readonly senderId: string;
  readonly receiverId: string;
  readonly message?: string;
  readonly timezone: string;
}

export interface SendReminderNudgeDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly reminderNudgeRepository: Pick<
    ReminderNudgeRepositoryPort,
    "nextId" | "findLastSentTo" | "save"
  >;
  readonly targetReader: Pick<ReminderTargetReaderPort, "countTodosOn">;
  readonly mutualFriendReader: Pick<
    MutualFriendReaderPort,
    "isMutualFriend" | "getUserDisplayName"
  >;
  readonly notifier: Pick<ReminderNudgeNotifierPort, "notifyNudgeSent">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class SendReminderNudgeUseCase {
  readonly #dependencies: SendReminderNudgeDependencies;

  constructor(dependencies: SendReminderNudgeDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: SendReminderNudgeCommand): Promise<ReminderNudge> {
    const {
      unitOfWork,
      mutationLock,
      reminderNudgeRepository,
      targetReader,
      mutualFriendReader,
      notifier,
      clock,
      logger,
    } = this.#dependencies;
    const senderId = UserId.reconstitute(command.senderId);
    const receiverId = UserId.reconstitute(command.receiverId);

    // 자기 자신 → 친구 아님 → 메시지 → 오늘 할 일 → 쿨다운 순서는 출시 앱이 받는 오류 우선순위다
    if (senderId.equals(receiverId)) {
      throw cannotNudgeSelf();
    }
    if (!(await mutualFriendReader.isMutualFriend(senderId, receiverId))) {
      throw reminderTargetNotFriend(receiverId);
    }
    const message = command.message == null ? null : NudgeMessage.create(command.message);
    // 친구의 "오늘"도 보낸 사람이 요청한 시간대로 본다
    const requestedAt = clock.now();
    const today = dailySendWindowAt({ now: requestedAt, timeZone: command.timezone }).localDate;

    const reminder = await unitOfWork.run(async () => {
      await mutationLock.acquire([ReminderNudgeLockKeys.cooldown(senderId, receiverId)]);

      if ((await targetReader.countTodosOn(receiverId, today)) > 0) {
        throw reminderTargetHasTodayTodos(receiverId);
      }

      const lastReminder = await reminderNudgeRepository.findLastSentTo(senderId, receiverId);
      const cooldown = evaluateReminderNudgeCooldown({
        lastSentAt: lastReminder?.createdAt ?? null,
        now: clock.now(),
      });
      if (cooldown.isActive) {
        throw reminderNudgeCooldownActive(receiverId, cooldown.remainingSeconds);
      }

      const created = ReminderNudge.create({
        id: await reminderNudgeRepository.nextId(),
        senderId,
        receiverId,
        message,
        now: requestedAt,
      });
      await reminderNudgeRepository.save(created);
      // 알림 작업은 리마인드 저장과 같은 트랜잭션에 넣어 커밋 직후 프로세스가 멈춰도 잃지 않는다
      await notifier.notifyNudgeSent({
        nudgeId: created.id.value,
        senderId: senderId.value,
        receiverId: receiverId.value,
        senderName: await mutualFriendReader.getUserDisplayName(senderId),
        message: message?.value,
      });
      return created;
    });

    logger.log({
      event: ReminderNudgeLogEvent.SENT,
      nudgeId: reminder.id.value,
      senderId: senderId.value,
      receiverId: receiverId.value,
    });
    return reminder;
  }
}
