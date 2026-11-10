import { Logger, type FactoryProvider } from "@nestjs/common";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import { FOLLOW_READER } from "#api/modules/social/friends/social-friends.public";
import { PaginationService } from "#api/shared/application/pagination/index";
import { UNIT_OF_WORK, MUTATION_LOCK } from "#api/shared/application/ports/index";

import { DailySendUsageReader } from "../cheers/application/daily-send-usage.reader.js";
import { NUDGE_USAGE_READER } from "../cheers/application/ports/daily-send-usage.reader.port.js";
import { NUDGE_INTERACTION_CONFIG } from "./application/ports/nudge-interaction-config.port.js";
import { NUDGE_LIMIT_READER } from "./application/ports/nudge-limit.reader.port.js";
import { NUDGE_NOTIFIER } from "./application/ports/nudge-notifier.port.js";
import { NUDGE_REPOSITORY } from "./application/ports/nudge.repository.port.js";
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

export const getNudgeInteractionProvider: FactoryProvider<GetNudgeInteractionUseCase> = {
  provide: GetNudgeInteractionUseCase,
  inject: [NUDGE_REPOSITORY, NUDGE_INTERACTION_CONFIG, FOLLOW_READER],
  useFactory: (
    nudgeRepository: ConstructorParameters<typeof GetNudgeInteractionUseCase>[0]["nudgeRepository"],
    nudgeInteractionConfig: ConstructorParameters<
      typeof GetNudgeInteractionUseCase
    >[0]["nudgeInteractionConfig"],
    followReader: ConstructorParameters<typeof GetNudgeInteractionUseCase>[0]["followReader"],
  ) =>
    new GetNudgeInteractionUseCase({
      nudgeRepository,
      nudgeInteractionConfig,
      followReader,
    }),
};

export const getNudgeInteractionAvailabilityProvider: FactoryProvider<GetNudgeInteractionAvailabilityUseCase> =
  {
    provide: GetNudgeInteractionAvailabilityUseCase,
    inject: [NUDGE_INTERACTION_CONFIG],
    useFactory: (
      nudgeInteractionConfig: ConstructorParameters<
        typeof GetNudgeInteractionAvailabilityUseCase
      >[0]["nudgeInteractionConfig"],
    ) =>
      new GetNudgeInteractionAvailabilityUseCase({
        nudgeInteractionConfig,
      }),
  };

export const getNudgeInteractionsProvider: FactoryProvider<GetNudgeInteractionsUseCase> = {
  provide: GetNudgeInteractionsUseCase,
  inject: [NUDGE_REPOSITORY, NUDGE_INTERACTION_CONFIG, FOLLOW_READER, PaginationService],
  useFactory: (
    nudgeRepository: ConstructorParameters<
      typeof GetNudgeInteractionsUseCase
    >[0]["nudgeRepository"],
    nudgeInteractionConfig: ConstructorParameters<
      typeof GetNudgeInteractionsUseCase
    >[0]["nudgeInteractionConfig"],
    followReader: ConstructorParameters<typeof GetNudgeInteractionsUseCase>[0]["followReader"],
    paginationService: ConstructorParameters<
      typeof GetNudgeInteractionsUseCase
    >[0]["paginationService"],
  ) =>
    new GetNudgeInteractionsUseCase({
      nudgeRepository,
      nudgeInteractionConfig,
      followReader,
      paginationService,
    }),
};

export const getNudgeThanksPreviewProvider: FactoryProvider<GetNudgeThanksPreviewUseCase> = {
  provide: GetNudgeThanksPreviewUseCase,
  inject: [NUDGE_REPOSITORY, NUDGE_INTERACTION_CONFIG, FOLLOW_READER],
  useFactory: (
    nudgeRepository: ConstructorParameters<
      typeof GetNudgeThanksPreviewUseCase
    >[0]["nudgeRepository"],
    nudgeInteractionConfig: ConstructorParameters<
      typeof GetNudgeThanksPreviewUseCase
    >[0]["nudgeInteractionConfig"],
    followReader: ConstructorParameters<typeof GetNudgeThanksPreviewUseCase>[0]["followReader"],
  ) =>
    new GetNudgeThanksPreviewUseCase({
      nudgeRepository,
      nudgeInteractionConfig,
      followReader,
    }),
};

export const markNudgeReadProvider: FactoryProvider<MarkNudgeReadUseCase> = {
  provide: MarkNudgeReadUseCase,
  inject: [NUDGE_REPOSITORY],
  useFactory: (
    nudgeRepository: ConstructorParameters<typeof MarkNudgeReadUseCase>[0]["nudgeRepository"],
  ) =>
    new MarkNudgeReadUseCase({
      nudgeRepository,
      logger: new Logger(MarkNudgeReadUseCase.name),
    }),
};

export const replyToNudgeProvider: FactoryProvider<ReplyToNudgeUseCase> = {
  provide: ReplyToNudgeUseCase,
  inject: [NUDGE_REPOSITORY, NUDGE_INTERACTION_CONFIG, NUDGE_NOTIFIER, UNIT_OF_WORK, FOLLOW_READER],
  useFactory: (
    nudgeRepository: ConstructorParameters<typeof ReplyToNudgeUseCase>[0]["nudgeRepository"],
    nudgeInteractionConfig: ConstructorParameters<
      typeof ReplyToNudgeUseCase
    >[0]["nudgeInteractionConfig"],
    nudgeNotifier: ConstructorParameters<typeof ReplyToNudgeUseCase>[0]["nudgeNotifier"],
    unitOfWork: ConstructorParameters<typeof ReplyToNudgeUseCase>[0]["unitOfWork"],
    followReader: ConstructorParameters<typeof ReplyToNudgeUseCase>[0]["followReader"],
  ) =>
    new ReplyToNudgeUseCase({
      nudgeRepository,
      nudgeInteractionConfig,
      nudgeNotifier,
      unitOfWork,
      followReader,
    }),
};

export const sendNudgeProvider: FactoryProvider<SendNudgeUseCase> = {
  provide: SendNudgeUseCase,
  inject: [
    NUDGE_REPOSITORY,
    NUDGE_NOTIFIER,
    NUDGE_LIMIT_READER,
    MUTATION_LOCK,
    UNIT_OF_WORK,
    FOLLOW_READER,
  ],
  useFactory: (
    nudgeRepository: ConstructorParameters<typeof SendNudgeUseCase>[0]["nudgeRepository"],
    notifier: ConstructorParameters<typeof SendNudgeUseCase>[0]["notifier"],
    limitReader: ConstructorParameters<typeof SendNudgeUseCase>[0]["limitReader"],
    mutationLock: ConstructorParameters<typeof SendNudgeUseCase>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof SendNudgeUseCase>[0]["unitOfWork"],
    followReader: ConstructorParameters<typeof SendNudgeUseCase>[0]["followReader"],
  ) =>
    new SendNudgeUseCase({
      nudgeRepository,
      notifier,
      limitReader,
      mutationLock,
      unitOfWork,
      followReader,
      logger: new Logger(SendNudgeUseCase.name),
    }),
};

export const sendNudgeThanksProvider: FactoryProvider<SendNudgeThanksUseCase> = {
  provide: SendNudgeThanksUseCase,
  inject: [NUDGE_REPOSITORY, NUDGE_INTERACTION_CONFIG, NUDGE_NOTIFIER, UNIT_OF_WORK, FOLLOW_READER],
  useFactory: (
    nudgeRepository: ConstructorParameters<typeof SendNudgeThanksUseCase>[0]["nudgeRepository"],
    nudgeInteractionConfig: ConstructorParameters<
      typeof SendNudgeThanksUseCase
    >[0]["nudgeInteractionConfig"],
    nudgeNotifier: ConstructorParameters<typeof SendNudgeThanksUseCase>[0]["nudgeNotifier"],
    unitOfWork: ConstructorParameters<typeof SendNudgeThanksUseCase>[0]["unitOfWork"],
    followReader: ConstructorParameters<typeof SendNudgeThanksUseCase>[0]["followReader"],
  ) =>
    new SendNudgeThanksUseCase({
      nudgeRepository,
      nudgeInteractionConfig,
      nudgeNotifier,
      unitOfWork,
      followReader,
    }),
};

export const sendRemindNudgeProvider: FactoryProvider<SendRemindNudgeUseCase> = {
  provide: SendRemindNudgeUseCase,
  inject: [NUDGE_REPOSITORY, NUDGE_NOTIFIER, MUTATION_LOCK, UNIT_OF_WORK, FOLLOW_READER],
  useFactory: (
    nudgeRepository: ConstructorParameters<typeof SendRemindNudgeUseCase>[0]["nudgeRepository"],
    notifier: ConstructorParameters<typeof SendRemindNudgeUseCase>[0]["notifier"],
    mutationLock: ConstructorParameters<typeof SendRemindNudgeUseCase>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof SendRemindNudgeUseCase>[0]["unitOfWork"],
    followReader: ConstructorParameters<typeof SendRemindNudgeUseCase>[0]["followReader"],
  ) =>
    new SendRemindNudgeUseCase({
      nudgeRepository,
      notifier,
      mutationLock,
      unitOfWork,
      followReader,
      logger: new Logger(SendRemindNudgeUseCase.name),
    }),
};

export const getReceivedNudgesProvider: FactoryProvider<GetReceivedNudgesUseCase> = {
  provide: GetReceivedNudgesUseCase,
  inject: [NUDGE_REPOSITORY, PaginationService],
  useFactory: (
    nudgeRepository: ConstructorParameters<typeof GetReceivedNudgesUseCase>[0]["nudgeRepository"],
    paginationService: ConstructorParameters<
      typeof GetReceivedNudgesUseCase
    >[0]["paginationService"],
  ) =>
    new GetReceivedNudgesUseCase({
      nudgeRepository,
      paginationService,
      logger: new Logger(GetReceivedNudgesUseCase.name),
    }),
};

export const getSentNudgesProvider: FactoryProvider<GetSentNudgesUseCase> = {
  provide: GetSentNudgesUseCase,
  inject: [NUDGE_REPOSITORY, PaginationService],
  useFactory: (
    nudgeRepository: ConstructorParameters<typeof GetSentNudgesUseCase>[0]["nudgeRepository"],
    paginationService: ConstructorParameters<typeof GetSentNudgesUseCase>[0]["paginationService"],
  ) =>
    new GetSentNudgesUseCase({
      nudgeRepository,
      paginationService,
      logger: new Logger(GetSentNudgesUseCase.name),
    }),
};

export const getNudgeLimitProvider: FactoryProvider<GetNudgeLimitUseCase> = {
  provide: GetNudgeLimitUseCase,
  inject: [NUDGE_REPOSITORY, ENTITLEMENT_READER],
  useFactory: (
    nudgeRepository: ConstructorParameters<typeof GetNudgeLimitUseCase>[0]["nudgeRepository"],
    entitlementReader: ConstructorParameters<typeof GetNudgeLimitUseCase>[0]["entitlementReader"],
  ) => new GetNudgeLimitUseCase({ nudgeRepository, entitlementReader }),
};

export const getNudgeCooldownProvider: FactoryProvider<GetNudgeCooldownUseCase> = {
  provide: GetNudgeCooldownUseCase,
  inject: [NUDGE_REPOSITORY],
  useFactory: (
    nudgeRepository: ConstructorParameters<typeof GetNudgeCooldownUseCase>[0]["nudgeRepository"],
  ) => new GetNudgeCooldownUseCase({ nudgeRepository }),
};

export const getRemindNudgeCooldownProvider: FactoryProvider<GetRemindNudgeCooldownUseCase> = {
  provide: GetRemindNudgeCooldownUseCase,
  inject: [NUDGE_REPOSITORY],
  useFactory: (
    nudgeRepository: ConstructorParameters<
      typeof GetRemindNudgeCooldownUseCase
    >[0]["nudgeRepository"],
  ) => new GetRemindNudgeCooldownUseCase({ nudgeRepository }),
};

export const nudgeUsageReaderProvider: FactoryProvider<DailySendUsageReader> = {
  provide: NUDGE_USAGE_READER,
  inject: [NUDGE_REPOSITORY],
  useFactory: (sentCounter: ConstructorParameters<typeof DailySendUsageReader>[0]["sentCounter"]) =>
    new DailySendUsageReader({ sentCounter }),
};
