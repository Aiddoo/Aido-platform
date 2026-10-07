import { Logger, type FactoryProvider } from "@nestjs/common";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import { FOLLOW_READER } from "#api/modules/social/social-friends.public";
import { PaginationService } from "#api/shared/application/pagination/index";
import { MUTATION_LOCK, UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { CHEER_LIMIT_READER } from "./application/ports/cheers/cheer-limit-reader.port.js";
import { CHEER_NOTIFIER } from "./application/ports/cheers/cheer-notifier.port.js";
import { CHEER_REPOSITORY } from "./application/ports/cheers/cheer.repository.port.js";
import { GetCheerCooldown } from "./application/use-cases/cheers/get-cheer-cooldown.use-case.js";
import { GetCheerLimit } from "./application/use-cases/cheers/get-cheer-limit.use-case.js";
import { GetReceivedCheers } from "./application/use-cases/cheers/get-received-cheers.use-case.js";
import { GetSentCheers } from "./application/use-cases/cheers/get-sent-cheers.use-case.js";
import { MarkCheerRead } from "./application/use-cases/cheers/mark-cheer-read.use-case.js";
import { MarkManyCheersRead } from "./application/use-cases/cheers/mark-many-cheers-read.use-case.js";
import { SendCheer } from "./application/use-cases/cheers/send-cheer.use-case.js";

export const markCheerReadProvider: FactoryProvider<MarkCheerRead> = {
  provide: MarkCheerRead,
  inject: [CHEER_REPOSITORY],
  useFactory: (
    cheerRepository: ConstructorParameters<typeof MarkCheerRead>[0]["cheerRepository"],
  ) =>
    new MarkCheerRead({
      cheerRepository,
      logger: new Logger(MarkCheerRead.name),
    }),
};

export const markManyCheersReadProvider: FactoryProvider<MarkManyCheersRead> = {
  provide: MarkManyCheersRead,
  inject: [CHEER_REPOSITORY],
  useFactory: (
    cheerRepository: ConstructorParameters<typeof MarkManyCheersRead>[0]["cheerRepository"],
  ) =>
    new MarkManyCheersRead({
      cheerRepository,
      logger: new Logger(MarkManyCheersRead.name),
    }),
};

export const sendCheerProvider: FactoryProvider<SendCheer> = {
  provide: SendCheer,
  inject: [
    CHEER_REPOSITORY,
    CHEER_NOTIFIER,
    CHEER_LIMIT_READER,
    MUTATION_LOCK,
    UNIT_OF_WORK,
    FOLLOW_READER,
  ],
  useFactory: (
    cheerRepository: ConstructorParameters<typeof SendCheer>[0]["cheerRepository"],
    notifier: ConstructorParameters<typeof SendCheer>[0]["notifier"],
    limitReader: ConstructorParameters<typeof SendCheer>[0]["limitReader"],
    mutationLock: ConstructorParameters<typeof SendCheer>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof SendCheer>[0]["unitOfWork"],
    followReader: ConstructorParameters<typeof SendCheer>[0]["followReader"],
  ) =>
    new SendCheer({
      cheerRepository,
      notifier,
      limitReader,
      mutationLock,
      unitOfWork,
      followReader,
      logger: new Logger(SendCheer.name),
    }),
};

export const getReceivedCheersProvider: FactoryProvider<GetReceivedCheers> = {
  provide: GetReceivedCheers,
  inject: [CHEER_REPOSITORY, PaginationService],
  useFactory: (
    cheerRepository: ConstructorParameters<typeof GetReceivedCheers>[0]["cheerRepository"],
    paginationService: ConstructorParameters<typeof GetReceivedCheers>[0]["paginationService"],
  ) =>
    new GetReceivedCheers({
      cheerRepository,
      paginationService,
      logger: new Logger(GetReceivedCheers.name),
    }),
};

export const getSentCheersProvider: FactoryProvider<GetSentCheers> = {
  provide: GetSentCheers,
  inject: [CHEER_REPOSITORY, PaginationService],
  useFactory: (
    cheerRepository: ConstructorParameters<typeof GetSentCheers>[0]["cheerRepository"],
    paginationService: ConstructorParameters<typeof GetSentCheers>[0]["paginationService"],
  ) =>
    new GetSentCheers({
      cheerRepository,
      paginationService,
      logger: new Logger(GetSentCheers.name),
    }),
};

export const getCheerLimitProvider: FactoryProvider<GetCheerLimit> = {
  provide: GetCheerLimit,
  inject: [CHEER_REPOSITORY, ENTITLEMENT_READER],
  useFactory: (
    cheerRepository: ConstructorParameters<typeof GetCheerLimit>[0]["cheerRepository"],
    entitlementReader: ConstructorParameters<typeof GetCheerLimit>[0]["entitlementReader"],
  ) => new GetCheerLimit({ cheerRepository, entitlementReader }),
};

export const getCheerCooldownProvider: FactoryProvider<GetCheerCooldown> = {
  provide: GetCheerCooldown,
  inject: [CHEER_REPOSITORY],
  useFactory: (
    cheerRepository: ConstructorParameters<typeof GetCheerCooldown>[0]["cheerRepository"],
  ) => new GetCheerCooldown({ cheerRepository }),
};
