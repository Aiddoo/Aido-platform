import type { Provider } from "@nestjs/common";

import { CheerCountCachePort } from "#api/modules/social/cheers/social-cheers.public";
import { FriendshipSeverancePort } from "#api/modules/social/friends/social-friends.public";
import { NudgeCountCachePort } from "#api/modules/social/nudges/social-nudges.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { BlockedUserReaderPort } from "./application/ports/blocked-user.reader.port.js";
import { UserBlockRepositoryPort } from "./application/ports/user-block.repository.port.js";
import { BlockUserUseCase } from "./application/use-cases/block-user.use-case.js";
import { GetBlockedUsersUseCase } from "./application/use-cases/get-blocked-users.use-case.js";
import { UnblockUserUseCase } from "./application/use-cases/unblock-user.use-case.js";
import { DrizzleBlockedUserReader } from "./infrastructure/persistence/drizzle-blocked-user.reader.js";
import { DrizzleUserBlockRepository } from "./infrastructure/persistence/drizzle-user-block.repository.js";

export const SOCIAL_BLOCKS_PROVIDERS = [
  { provide: UserBlockRepositoryPort, useClass: DrizzleUserBlockRepository },
  { provide: BlockedUserReaderPort, useClass: DrizzleBlockedUserReader },
  provideUseCase(BlockUserUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    userBlockRepository: UserBlockRepositoryPort,
    friendshipSeverance: FriendshipSeverancePort,
    nudgeCountCache: NudgeCountCachePort,
    cheerCountCache: CheerCountCachePort,
    clock: ClockPort,
    logger: loggerFor(BlockUserUseCase),
  }),
  provideUseCase(UnblockUserUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    userBlockRepository: UserBlockRepositoryPort,
    nudgeCountCache: NudgeCountCachePort,
    cheerCountCache: CheerCountCachePort,
    logger: loggerFor(UnblockUserUseCase),
  }),
  provideUseCase(GetBlockedUsersUseCase, { blockedUserReader: BlockedUserReaderPort }),
] satisfies Provider[];
