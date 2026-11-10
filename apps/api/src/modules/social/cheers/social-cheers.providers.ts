import { Logger, type FactoryProvider } from "@nestjs/common";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import { FOLLOW_READER } from "#api/modules/social/friends/social-friends.public";
import { PaginationService } from "#api/shared/application/pagination/index";
import { MUTATION_LOCK, UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { DailySendUsageReader } from "./application/daily-send-usage.reader.js";
import { CHEER_LIMIT_READER } from "./application/ports/cheer-limit.reader.port.js";
import { CHEER_NOTIFIER } from "./application/ports/cheer-notifier.port.js";
import { CHEER_REPOSITORY } from "./application/ports/cheer.repository.port.js";
import { CHEER_USAGE_READER } from "./application/ports/daily-send-usage.reader.port.js";
import { GetCheerCooldownUseCase } from "./application/use-cases/get-cheer-cooldown.use-case.js";
import { GetCheerLimitUseCase } from "./application/use-cases/get-cheer-limit.use-case.js";
import { GetReceivedCheersUseCase } from "./application/use-cases/get-received-cheers.use-case.js";
import { GetSentCheersUseCase } from "./application/use-cases/get-sent-cheers.use-case.js";
import { MarkCheerReadUseCase } from "./application/use-cases/mark-cheer-read.use-case.js";
import { MarkManyCheersReadUseCase } from "./application/use-cases/mark-many-cheers-read.use-case.js";
import { SendCheerUseCase } from "./application/use-cases/send-cheer.use-case.js";

export const markCheerReadProvider: FactoryProvider<MarkCheerReadUseCase> = {
  provide: MarkCheerReadUseCase,
  inject: [CHEER_REPOSITORY],
  useFactory: (
    cheerRepository: ConstructorParameters<typeof MarkCheerReadUseCase>[0]["cheerRepository"],
  ) =>
    new MarkCheerReadUseCase({
      cheerRepository,
      logger: new Logger(MarkCheerReadUseCase.name),
    }),
};

export const markManyCheersReadProvider: FactoryProvider<MarkManyCheersReadUseCase> = {
  provide: MarkManyCheersReadUseCase,
  inject: [CHEER_REPOSITORY],
  useFactory: (
    cheerRepository: ConstructorParameters<typeof MarkManyCheersReadUseCase>[0]["cheerRepository"],
  ) =>
    new MarkManyCheersReadUseCase({
      cheerRepository,
      logger: new Logger(MarkManyCheersReadUseCase.name),
    }),
};

export const sendCheerProvider: FactoryProvider<SendCheerUseCase> = {
  provide: SendCheerUseCase,
  inject: [
    CHEER_REPOSITORY,
    CHEER_NOTIFIER,
    CHEER_LIMIT_READER,
    MUTATION_LOCK,
    UNIT_OF_WORK,
    FOLLOW_READER,
  ],
  useFactory: (
    cheerRepository: ConstructorParameters<typeof SendCheerUseCase>[0]["cheerRepository"],
    notifier: ConstructorParameters<typeof SendCheerUseCase>[0]["notifier"],
    limitReader: ConstructorParameters<typeof SendCheerUseCase>[0]["limitReader"],
    mutationLock: ConstructorParameters<typeof SendCheerUseCase>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof SendCheerUseCase>[0]["unitOfWork"],
    followReader: ConstructorParameters<typeof SendCheerUseCase>[0]["followReader"],
  ) =>
    new SendCheerUseCase({
      cheerRepository,
      notifier,
      limitReader,
      mutationLock,
      unitOfWork,
      followReader,
      logger: new Logger(SendCheerUseCase.name),
    }),
};

export const getReceivedCheersProvider: FactoryProvider<GetReceivedCheersUseCase> = {
  provide: GetReceivedCheersUseCase,
  inject: [CHEER_REPOSITORY, PaginationService],
  useFactory: (
    cheerRepository: ConstructorParameters<typeof GetReceivedCheersUseCase>[0]["cheerRepository"],
    paginationService: ConstructorParameters<
      typeof GetReceivedCheersUseCase
    >[0]["paginationService"],
  ) =>
    new GetReceivedCheersUseCase({
      cheerRepository,
      paginationService,
      logger: new Logger(GetReceivedCheersUseCase.name),
    }),
};

export const getSentCheersProvider: FactoryProvider<GetSentCheersUseCase> = {
  provide: GetSentCheersUseCase,
  inject: [CHEER_REPOSITORY, PaginationService],
  useFactory: (
    cheerRepository: ConstructorParameters<typeof GetSentCheersUseCase>[0]["cheerRepository"],
    paginationService: ConstructorParameters<typeof GetSentCheersUseCase>[0]["paginationService"],
  ) =>
    new GetSentCheersUseCase({
      cheerRepository,
      paginationService,
      logger: new Logger(GetSentCheersUseCase.name),
    }),
};

export const getCheerLimitProvider: FactoryProvider<GetCheerLimitUseCase> = {
  provide: GetCheerLimitUseCase,
  inject: [CHEER_REPOSITORY, ENTITLEMENT_READER],
  useFactory: (
    cheerRepository: ConstructorParameters<typeof GetCheerLimitUseCase>[0]["cheerRepository"],
    entitlementReader: ConstructorParameters<typeof GetCheerLimitUseCase>[0]["entitlementReader"],
  ) => new GetCheerLimitUseCase({ cheerRepository, entitlementReader }),
};

export const getCheerCooldownProvider: FactoryProvider<GetCheerCooldownUseCase> = {
  provide: GetCheerCooldownUseCase,
  inject: [CHEER_REPOSITORY],
  useFactory: (
    cheerRepository: ConstructorParameters<typeof GetCheerCooldownUseCase>[0]["cheerRepository"],
  ) => new GetCheerCooldownUseCase({ cheerRepository }),
};

export const cheerUsageReaderProvider: FactoryProvider<DailySendUsageReader> = {
  provide: CHEER_USAGE_READER,
  inject: [CHEER_REPOSITORY],
  useFactory: (sentCounter: ConstructorParameters<typeof DailySendUsageReader>[0]["sentCounter"]) =>
    new DailySendUsageReader({ sentCounter }),
};
