import type { Provider } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";

import { FollowReaderPort } from "#api/modules/social/friends/social-friends.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { NudgeUsageReader } from "./application/nudge-usage.reader.js";
import { NudgeCountCachePort } from "./application/ports/nudge-count-cache.port.js";
import { NudgeInteractionConfigPort } from "./application/ports/nudge-interaction-config.port.js";
import { NudgeLimitReaderPort } from "./application/ports/nudge-limit.reader.port.js";
import { NudgeNotifierPort } from "./application/ports/nudge-notifier.port.js";
import { NudgeUsageReaderPort } from "./application/ports/nudge-usage.reader.port.js";
import { NudgeReaderPort } from "./application/ports/nudge.reader.port.js";
import { NudgeRepositoryPort } from "./application/ports/nudge.repository.port.js";
import { GetNudgeCooldownUseCase } from "./application/use-cases/get-nudge-cooldown.use-case.js";
import { GetNudgeInteractionAvailabilityUseCase } from "./application/use-cases/get-nudge-interaction-availability.use-case.js";
import { GetNudgeInteractionUseCase } from "./application/use-cases/get-nudge-interaction.use-case.js";
import { GetNudgeInteractionsUseCase } from "./application/use-cases/get-nudge-interactions.use-case.js";
import { GetNudgeLimitUseCase } from "./application/use-cases/get-nudge-limit.use-case.js";
import { GetNudgeThanksPreviewUseCase } from "./application/use-cases/get-nudge-thanks-preview.use-case.js";
import { GetReceivedNudgesUseCase } from "./application/use-cases/get-received-nudges.use-case.js";
import { GetRemindNudgeCooldownUseCase } from "./application/use-cases/get-remind-nudge-cooldown.use-case.js";
import { GetSentNudgesUseCase } from "./application/use-cases/get-sent-nudges.use-case.js";
import { MarkNudgeReadUseCase } from "./application/use-cases/mark-nudge-read.use-case.js";
import { ReplyToNudgeUseCase } from "./application/use-cases/reply-to-nudge.use-case.js";
import { SendNudgeThanksUseCase } from "./application/use-cases/send-nudge-thanks.use-case.js";
import { SendNudgeUseCase } from "./application/use-cases/send-nudge.use-case.js";
import { SendRemindNudgeUseCase } from "./application/use-cases/send-remind-nudge.use-case.js";
import { NudgeCountCacheAdapter } from "./infrastructure/adapters/nudge-count-cache.adapter.js";
import { NudgeLimitReaderAdapter } from "./infrastructure/adapters/nudge-limit-reader.adapter.js";
import { NudgeNotifierAdapter } from "./infrastructure/adapters/nudge-notifier.adapter.js";
import { DrizzleNudgeRepository } from "./infrastructure/persistence/drizzle-nudge.repository.js";
import { socialNudgesConfig } from "./social-nudges.config.js";

export const SOCIAL_NUDGES_PROVIDERS = [
  { provide: NudgeRepositoryPort, useClass: DrizzleNudgeRepository },
  { provide: NudgeReaderPort, useExisting: NudgeRepositoryPort },
  { provide: NudgeLimitReaderPort, useClass: NudgeLimitReaderAdapter },
  { provide: NudgeNotifierPort, useClass: NudgeNotifierAdapter },
  { provide: NudgeCountCachePort, useClass: NudgeCountCacheAdapter },
  {
    provide: NudgeInteractionConfigPort,
    inject: [socialNudgesConfig.KEY],
    useFactory: (config: ConfigType<typeof socialNudgesConfig>): NudgeInteractionConfigPort => ({
      isEnabled: config.interactionsEnabled,
    }),
  },
  provideUseCase(NudgeUsageReader, { nudgeRepository: NudgeRepositoryPort, clock: ClockPort }),
  { provide: NudgeUsageReaderPort, useExisting: NudgeUsageReader },
  provideUseCase(SendNudgeUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    nudgeRepository: NudgeRepositoryPort,
    limitReader: NudgeLimitReaderPort,
    followReader: FollowReaderPort,
    notifier: NudgeNotifierPort,
    countCache: NudgeCountCachePort,
    clock: ClockPort,
    logger: loggerFor(SendNudgeUseCase),
  }),
  provideUseCase(SendRemindNudgeUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    nudgeRepository: NudgeRepositoryPort,
    followReader: FollowReaderPort,
    notifier: NudgeNotifierPort,
    clock: ClockPort,
    logger: loggerFor(SendRemindNudgeUseCase),
  }),
  provideUseCase(GetReceivedNudgesUseCase, {
    nudgeReader: NudgeReaderPort,
    countCache: NudgeCountCachePort,
    logger: loggerFor(GetReceivedNudgesUseCase),
  }),
  provideUseCase(GetSentNudgesUseCase, {
    nudgeReader: NudgeReaderPort,
    countCache: NudgeCountCachePort,
    logger: loggerFor(GetSentNudgesUseCase),
  }),
  provideUseCase(GetNudgeLimitUseCase, {
    nudgeRepository: NudgeRepositoryPort,
    limitReader: NudgeLimitReaderPort,
    clock: ClockPort,
  }),
  provideUseCase(GetNudgeCooldownUseCase, {
    nudgeRepository: NudgeRepositoryPort,
    clock: ClockPort,
  }),
  provideUseCase(GetRemindNudgeCooldownUseCase, {
    nudgeRepository: NudgeRepositoryPort,
    clock: ClockPort,
  }),
  provideUseCase(MarkNudgeReadUseCase, {
    unitOfWork: UnitOfWorkPort,
    nudgeRepository: NudgeRepositoryPort,
    countCache: NudgeCountCachePort,
    clock: ClockPort,
    logger: loggerFor(MarkNudgeReadUseCase),
  }),
  provideUseCase(GetNudgeInteractionAvailabilityUseCase, {
    interactionConfig: NudgeInteractionConfigPort,
  }),
  provideUseCase(GetNudgeInteractionsUseCase, {
    nudgeReader: NudgeReaderPort,
    interactionConfig: NudgeInteractionConfigPort,
    followReader: FollowReaderPort,
  }),
  provideUseCase(GetNudgeInteractionUseCase, {
    nudgeReader: NudgeReaderPort,
    interactionConfig: NudgeInteractionConfigPort,
    followReader: FollowReaderPort,
  }),
  provideUseCase(GetNudgeThanksPreviewUseCase, {
    nudgeReader: NudgeReaderPort,
    interactionConfig: NudgeInteractionConfigPort,
    followReader: FollowReaderPort,
  }),
  provideUseCase(ReplyToNudgeUseCase, {
    unitOfWork: UnitOfWorkPort,
    nudgeRepository: NudgeRepositoryPort,
    nudgeReader: NudgeReaderPort,
    interactionConfig: NudgeInteractionConfigPort,
    followReader: FollowReaderPort,
    notifier: NudgeNotifierPort,
    clock: ClockPort,
  }),
  provideUseCase(SendNudgeThanksUseCase, {
    unitOfWork: UnitOfWorkPort,
    nudgeRepository: NudgeRepositoryPort,
    nudgeReader: NudgeReaderPort,
    interactionConfig: NudgeInteractionConfigPort,
    followReader: FollowReaderPort,
    notifier: NudgeNotifierPort,
    clock: ClockPort,
  }),
] satisfies Provider[];
