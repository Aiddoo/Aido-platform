import type { Provider } from "@nestjs/common";

import { MutualFriendReaderPort } from "#api/modules/social/friends/social-friends.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { ReminderNudgeNotifierPort } from "./application/ports/reminder-nudge-notifier.port.js";
import { ReminderNudgeRepositoryPort } from "./application/ports/reminder-nudge.repository.port.js";
import { ReminderTargetReaderPort } from "./application/ports/reminder-target.reader.port.js";
import { GetReminderNudgeCooldownUseCase } from "./application/use-cases/get-reminder-nudge-cooldown.use-case.js";
import { SendReminderNudgeUseCase } from "./application/use-cases/send-reminder-nudge.use-case.js";
import { ReminderNudgeNotifierAdapter } from "./infrastructure/adapters/reminder-nudge-notifier.adapter.js";
import { DrizzleReminderNudgeRepository } from "./infrastructure/persistence/drizzle-reminder-nudge.repository.js";
import { DrizzleReminderTargetReader } from "./infrastructure/persistence/drizzle-reminder-target.reader.js";

export const SOCIAL_REMINDER_NUDGES_PROVIDERS = [
  { provide: ReminderNudgeRepositoryPort, useClass: DrizzleReminderNudgeRepository },
  { provide: ReminderTargetReaderPort, useClass: DrizzleReminderTargetReader },
  { provide: ReminderNudgeNotifierPort, useClass: ReminderNudgeNotifierAdapter },
  provideUseCase(SendReminderNudgeUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    reminderNudgeRepository: ReminderNudgeRepositoryPort,
    targetReader: ReminderTargetReaderPort,
    mutualFriendReader: MutualFriendReaderPort,
    notifier: ReminderNudgeNotifierPort,
    clock: ClockPort,
    logger: loggerFor(SendReminderNudgeUseCase),
  }),
  provideUseCase(GetReminderNudgeCooldownUseCase, {
    reminderNudgeRepository: ReminderNudgeRepositoryPort,
    clock: ClockPort,
  }),
] satisfies Provider[];
