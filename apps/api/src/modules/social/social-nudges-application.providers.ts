import { Logger, type FactoryProvider } from "@nestjs/common";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import { FOLLOW_READER } from "#api/modules/social/social-friends.public";
import { PaginationService } from "#api/shared/application/pagination/index";
import { UNIT_OF_WORK, MUTATION_LOCK } from "#api/shared/application/ports/index";

import { NUDGE_INTERACTION_CONFIG } from "./application/ports/nudges/nudge-interaction.config.port.js";
import { NUDGE_LIMIT_READER } from "./application/ports/nudges/nudge-limit-reader.port.js";
import { NUDGE_NOTIFIER } from "./application/ports/nudges/nudge-notifier.port.js";
import { NUDGE_REPOSITORY } from "./application/ports/nudges/nudge.repository.port.js";
import { GetNudgeCooldown } from "./application/use-cases/nudges/get-nudge-cooldown.use-case.js";
import { GetNudgeInteractionAvailability } from "./application/use-cases/nudges/get-nudge-interaction-availability.use-case.js";
import { GetNudgeInteraction } from "./application/use-cases/nudges/get-nudge-interaction.use-case.js";
import { GetNudgeInteractions } from "./application/use-cases/nudges/get-nudge-interactions.use-case.js";
import { GetNudgeLimit } from "./application/use-cases/nudges/get-nudge-limit.use-case.js";
import { GetNudgeThanksPreview } from "./application/use-cases/nudges/get-nudge-thanks-preview.use-case.js";
import { GetReceivedNudges } from "./application/use-cases/nudges/get-received-nudges.use-case.js";
import { GetRemindNudgeCooldown } from "./application/use-cases/nudges/get-remind-nudge-cooldown.use-case.js";
import { GetSentNudges } from "./application/use-cases/nudges/get-sent-nudges.use-case.js";
import { MarkNudgeRead } from "./application/use-cases/nudges/mark-nudge-read.use-case.js";
import { ReplyToNudge } from "./application/use-cases/nudges/reply-to-nudge.use-case.js";
import { SendNudgeThanks } from "./application/use-cases/nudges/send-nudge-thanks.use-case.js";
import { SendNudge } from "./application/use-cases/nudges/send-nudge.use-case.js";
import { SendRemindNudge } from "./application/use-cases/nudges/send-remind-nudge.use-case.js";

export const getNudgeInteractionProvider: FactoryProvider<GetNudgeInteraction> = {
  provide: GetNudgeInteraction,
  inject: [NUDGE_REPOSITORY, NUDGE_INTERACTION_CONFIG, FOLLOW_READER],
  useFactory: (
    nudgeRepository: ConstructorParameters<typeof GetNudgeInteraction>[0]["nudgeRepository"],
    nudgeInteractionConfig: ConstructorParameters<
      typeof GetNudgeInteraction
    >[0]["nudgeInteractionConfig"],
    followReader: ConstructorParameters<typeof GetNudgeInteraction>[0]["followReader"],
  ) =>
    new GetNudgeInteraction({
      nudgeRepository,
      nudgeInteractionConfig,
      followReader,
    }),
};

export const getNudgeInteractionAvailabilityProvider: FactoryProvider<GetNudgeInteractionAvailability> =
  {
    provide: GetNudgeInteractionAvailability,
    inject: [NUDGE_INTERACTION_CONFIG],
    useFactory: (
      nudgeInteractionConfig: ConstructorParameters<
        typeof GetNudgeInteractionAvailability
      >[0]["nudgeInteractionConfig"],
    ) =>
      new GetNudgeInteractionAvailability({
        nudgeInteractionConfig,
      }),
  };

export const getNudgeInteractionsProvider: FactoryProvider<GetNudgeInteractions> = {
  provide: GetNudgeInteractions,
  inject: [NUDGE_REPOSITORY, NUDGE_INTERACTION_CONFIG, FOLLOW_READER, PaginationService],
  useFactory: (
    nudgeRepository: ConstructorParameters<typeof GetNudgeInteractions>[0]["nudgeRepository"],
    nudgeInteractionConfig: ConstructorParameters<
      typeof GetNudgeInteractions
    >[0]["nudgeInteractionConfig"],
    followReader: ConstructorParameters<typeof GetNudgeInteractions>[0]["followReader"],
    paginationService: ConstructorParameters<typeof GetNudgeInteractions>[0]["paginationService"],
  ) =>
    new GetNudgeInteractions({
      nudgeRepository,
      nudgeInteractionConfig,
      followReader,
      paginationService,
    }),
};

export const getNudgeThanksPreviewProvider: FactoryProvider<GetNudgeThanksPreview> = {
  provide: GetNudgeThanksPreview,
  inject: [NUDGE_REPOSITORY, NUDGE_INTERACTION_CONFIG, FOLLOW_READER],
  useFactory: (
    nudgeRepository: ConstructorParameters<typeof GetNudgeThanksPreview>[0]["nudgeRepository"],
    nudgeInteractionConfig: ConstructorParameters<
      typeof GetNudgeThanksPreview
    >[0]["nudgeInteractionConfig"],
    followReader: ConstructorParameters<typeof GetNudgeThanksPreview>[0]["followReader"],
  ) =>
    new GetNudgeThanksPreview({
      nudgeRepository,
      nudgeInteractionConfig,
      followReader,
    }),
};

export const markNudgeReadProvider: FactoryProvider<MarkNudgeRead> = {
  provide: MarkNudgeRead,
  inject: [NUDGE_REPOSITORY],
  useFactory: (
    nudgeRepository: ConstructorParameters<typeof MarkNudgeRead>[0]["nudgeRepository"],
  ) =>
    new MarkNudgeRead({
      nudgeRepository,
      logger: new Logger(MarkNudgeRead.name),
    }),
};

export const replyToNudgeProvider: FactoryProvider<ReplyToNudge> = {
  provide: ReplyToNudge,
  inject: [NUDGE_REPOSITORY, NUDGE_INTERACTION_CONFIG, NUDGE_NOTIFIER, UNIT_OF_WORK, FOLLOW_READER],
  useFactory: (
    nudgeRepository: ConstructorParameters<typeof ReplyToNudge>[0]["nudgeRepository"],
    nudgeInteractionConfig: ConstructorParameters<typeof ReplyToNudge>[0]["nudgeInteractionConfig"],
    nudgeNotifier: ConstructorParameters<typeof ReplyToNudge>[0]["nudgeNotifier"],
    unitOfWork: ConstructorParameters<typeof ReplyToNudge>[0]["unitOfWork"],
    followReader: ConstructorParameters<typeof ReplyToNudge>[0]["followReader"],
  ) =>
    new ReplyToNudge({
      nudgeRepository,
      nudgeInteractionConfig,
      nudgeNotifier,
      unitOfWork,
      followReader,
    }),
};

export const sendNudgeProvider: FactoryProvider<SendNudge> = {
  provide: SendNudge,
  inject: [
    NUDGE_REPOSITORY,
    NUDGE_NOTIFIER,
    NUDGE_LIMIT_READER,
    MUTATION_LOCK,
    UNIT_OF_WORK,
    FOLLOW_READER,
  ],
  useFactory: (
    nudgeRepository: ConstructorParameters<typeof SendNudge>[0]["nudgeRepository"],
    notifier: ConstructorParameters<typeof SendNudge>[0]["notifier"],
    limitReader: ConstructorParameters<typeof SendNudge>[0]["limitReader"],
    mutationLock: ConstructorParameters<typeof SendNudge>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof SendNudge>[0]["unitOfWork"],
    followReader: ConstructorParameters<typeof SendNudge>[0]["followReader"],
  ) =>
    new SendNudge({
      nudgeRepository,
      notifier,
      limitReader,
      mutationLock,
      unitOfWork,
      followReader,
      logger: new Logger(SendNudge.name),
    }),
};

export const sendNudgeThanksProvider: FactoryProvider<SendNudgeThanks> = {
  provide: SendNudgeThanks,
  inject: [NUDGE_REPOSITORY, NUDGE_INTERACTION_CONFIG, NUDGE_NOTIFIER, UNIT_OF_WORK, FOLLOW_READER],
  useFactory: (
    nudgeRepository: ConstructorParameters<typeof SendNudgeThanks>[0]["nudgeRepository"],
    nudgeInteractionConfig: ConstructorParameters<
      typeof SendNudgeThanks
    >[0]["nudgeInteractionConfig"],
    nudgeNotifier: ConstructorParameters<typeof SendNudgeThanks>[0]["nudgeNotifier"],
    unitOfWork: ConstructorParameters<typeof SendNudgeThanks>[0]["unitOfWork"],
    followReader: ConstructorParameters<typeof SendNudgeThanks>[0]["followReader"],
  ) =>
    new SendNudgeThanks({
      nudgeRepository,
      nudgeInteractionConfig,
      nudgeNotifier,
      unitOfWork,
      followReader,
    }),
};

export const sendRemindNudgeProvider: FactoryProvider<SendRemindNudge> = {
  provide: SendRemindNudge,
  inject: [NUDGE_REPOSITORY, NUDGE_NOTIFIER, MUTATION_LOCK, UNIT_OF_WORK, FOLLOW_READER],
  useFactory: (
    nudgeRepository: ConstructorParameters<typeof SendRemindNudge>[0]["nudgeRepository"],
    notifier: ConstructorParameters<typeof SendRemindNudge>[0]["notifier"],
    mutationLock: ConstructorParameters<typeof SendRemindNudge>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof SendRemindNudge>[0]["unitOfWork"],
    followReader: ConstructorParameters<typeof SendRemindNudge>[0]["followReader"],
  ) =>
    new SendRemindNudge({
      nudgeRepository,
      notifier,
      mutationLock,
      unitOfWork,
      followReader,
      logger: new Logger(SendRemindNudge.name),
    }),
};

export const getReceivedNudgesProvider: FactoryProvider<GetReceivedNudges> = {
  provide: GetReceivedNudges,
  inject: [NUDGE_REPOSITORY, PaginationService],
  useFactory: (
    nudgeRepository: ConstructorParameters<typeof GetReceivedNudges>[0]["nudgeRepository"],
    paginationService: ConstructorParameters<typeof GetReceivedNudges>[0]["paginationService"],
  ) =>
    new GetReceivedNudges({
      nudgeRepository,
      paginationService,
      logger: new Logger(GetReceivedNudges.name),
    }),
};

export const getSentNudgesProvider: FactoryProvider<GetSentNudges> = {
  provide: GetSentNudges,
  inject: [NUDGE_REPOSITORY, PaginationService],
  useFactory: (
    nudgeRepository: ConstructorParameters<typeof GetSentNudges>[0]["nudgeRepository"],
    paginationService: ConstructorParameters<typeof GetSentNudges>[0]["paginationService"],
  ) =>
    new GetSentNudges({
      nudgeRepository,
      paginationService,
      logger: new Logger(GetSentNudges.name),
    }),
};

export const getNudgeLimitProvider: FactoryProvider<GetNudgeLimit> = {
  provide: GetNudgeLimit,
  inject: [NUDGE_REPOSITORY, ENTITLEMENT_READER],
  useFactory: (
    nudgeRepository: ConstructorParameters<typeof GetNudgeLimit>[0]["nudgeRepository"],
    entitlementReader: ConstructorParameters<typeof GetNudgeLimit>[0]["entitlementReader"],
  ) => new GetNudgeLimit({ nudgeRepository, entitlementReader }),
};

export const getNudgeCooldownProvider: FactoryProvider<GetNudgeCooldown> = {
  provide: GetNudgeCooldown,
  inject: [NUDGE_REPOSITORY],
  useFactory: (
    nudgeRepository: ConstructorParameters<typeof GetNudgeCooldown>[0]["nudgeRepository"],
  ) => new GetNudgeCooldown({ nudgeRepository }),
};

export const getRemindNudgeCooldownProvider: FactoryProvider<GetRemindNudgeCooldown> = {
  provide: GetRemindNudgeCooldown,
  inject: [NUDGE_REPOSITORY],
  useFactory: (
    nudgeRepository: ConstructorParameters<typeof GetRemindNudgeCooldown>[0]["nudgeRepository"],
  ) => new GetRemindNudgeCooldown({ nudgeRepository }),
};
