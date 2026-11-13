import type { Provider } from "@nestjs/common";

import { MutualFriendReaderPort } from "#api/modules/social/friends/social-friends.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { CheerUsageReader } from "./application/cheer-usage.reader.js";
import { CheerCountCachePort } from "./application/ports/cheer-count-cache.port.js";
import { CheerLimitReaderPort } from "./application/ports/cheer-limit.reader.port.js";
import { CheerNotifierPort } from "./application/ports/cheer-notifier.port.js";
import { CheerUsageReaderPort } from "./application/ports/cheer-usage.reader.port.js";
import { CheerReaderPort } from "./application/ports/cheer.reader.port.js";
import { CheerRepositoryPort } from "./application/ports/cheer.repository.port.js";
import { GetCheerCooldownUseCase } from "./application/use-cases/get-cheer-cooldown.use-case.js";
import { GetCheerLimitUseCase } from "./application/use-cases/get-cheer-limit.use-case.js";
import { GetReceivedCheersUseCase } from "./application/use-cases/get-received-cheers.use-case.js";
import { GetSentCheersUseCase } from "./application/use-cases/get-sent-cheers.use-case.js";
import { MarkCheerReadUseCase } from "./application/use-cases/mark-cheer-read.use-case.js";
import { MarkManyCheersReadUseCase } from "./application/use-cases/mark-many-cheers-read.use-case.js";
import { SendCheerUseCase } from "./application/use-cases/send-cheer.use-case.js";
import { CheerCountCacheAdapter } from "./infrastructure/adapters/cheer-count-cache.adapter.js";
import { CheerLimitReaderAdapter } from "./infrastructure/adapters/cheer-limit-reader.adapter.js";
import { CheerNotifierAdapter } from "./infrastructure/adapters/cheer-notifier.adapter.js";
import { DrizzleCheerRepository } from "./infrastructure/persistence/drizzle-cheer.repository.js";

export const SOCIAL_CHEERS_PROVIDERS = [
  { provide: CheerRepositoryPort, useClass: DrizzleCheerRepository },
  { provide: CheerReaderPort, useExisting: CheerRepositoryPort },
  { provide: CheerLimitReaderPort, useClass: CheerLimitReaderAdapter },
  { provide: CheerNotifierPort, useClass: CheerNotifierAdapter },
  { provide: CheerCountCachePort, useClass: CheerCountCacheAdapter },
  provideUseCase(CheerUsageReader, { cheerRepository: CheerRepositoryPort, clock: ClockPort }),
  { provide: CheerUsageReaderPort, useExisting: CheerUsageReader },
  provideUseCase(SendCheerUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    cheerRepository: CheerRepositoryPort,
    limitReader: CheerLimitReaderPort,
    mutualFriendReader: MutualFriendReaderPort,
    notifier: CheerNotifierPort,
    countCache: CheerCountCachePort,
    clock: ClockPort,
    logger: loggerFor(SendCheerUseCase),
  }),
  provideUseCase(GetReceivedCheersUseCase, {
    cheerReader: CheerReaderPort,
    countCache: CheerCountCachePort,
    logger: loggerFor(GetReceivedCheersUseCase),
  }),
  provideUseCase(GetSentCheersUseCase, {
    cheerReader: CheerReaderPort,
    countCache: CheerCountCachePort,
    logger: loggerFor(GetSentCheersUseCase),
  }),
  provideUseCase(GetCheerLimitUseCase, {
    cheerRepository: CheerRepositoryPort,
    limitReader: CheerLimitReaderPort,
    clock: ClockPort,
  }),
  provideUseCase(GetCheerCooldownUseCase, {
    cheerRepository: CheerRepositoryPort,
    clock: ClockPort,
  }),
  provideUseCase(MarkCheerReadUseCase, {
    cheerRepository: CheerRepositoryPort,
    countCache: CheerCountCachePort,
    clock: ClockPort,
    logger: loggerFor(MarkCheerReadUseCase),
  }),
  provideUseCase(MarkManyCheersReadUseCase, {
    cheerRepository: CheerRepositoryPort,
    countCache: CheerCountCachePort,
    clock: ClockPort,
    logger: loggerFor(MarkManyCheersReadUseCase),
  }),
] satisfies Provider[];
