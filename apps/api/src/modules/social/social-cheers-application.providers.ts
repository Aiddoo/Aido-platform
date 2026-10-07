import { Logger, type FactoryProvider } from "@nestjs/common";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import { FollowReader } from "#api/modules/social/social-friends.public";
import { PaginationService } from "#api/shared/application/pagination/index";
import { MUTATION_LOCK, UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { CHEER_LIMIT_READER } from "./application/ports/cheers/cheer-limit-reader.port.js";
import { CHEER_NOTIFIER } from "./application/ports/cheers/cheer-notifier.port.js";
import { CHEER_REPOSITORY } from "./application/ports/cheers/cheer.repository.port.js";
import { CheerReader } from "./application/services/cheers/cheer.reader.js";
import { MarkCheerRead } from "./application/use-cases/cheers/mark-cheer-read.use-case.js";
import { MarkManyCheersRead } from "./application/use-cases/cheers/mark-many-cheers-read.use-case.js";
import { SendCheer } from "./application/use-cases/cheers/send-cheer.use-case.js";

export const cheerReaderProvider: FactoryProvider<CheerReader> = {
  provide: CheerReader,
  inject: [CHEER_REPOSITORY, PaginationService, ENTITLEMENT_READER],
  useFactory: (
    cheerRepository: ConstructorParameters<typeof CheerReader>[0]["cheerRepository"],
    paginationService: ConstructorParameters<typeof CheerReader>[0]["paginationService"],
    entitlementReader: ConstructorParameters<typeof CheerReader>[0]["entitlementReader"],
  ) =>
    new CheerReader({
      cheerRepository,
      paginationService,
      entitlementReader,
      logger: new Logger(CheerReader.name),
    }),
};

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
    FollowReader,
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
