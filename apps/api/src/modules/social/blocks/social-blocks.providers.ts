import type { Provider } from "@nestjs/common";

import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { FollowCachePort } from "../friends/application/ports/follow-cache.port.js";
import { FollowCacheAdapter } from "../friends/infrastructure/adapters/follow-cache.adapter.js";
import { BlockedUserReaderPort } from "./application/ports/blocked-user.reader.port.js";
import { UserBlockReaderPort } from "./application/ports/user-block.reader.port.js";
import { UserBlockRepositoryPort } from "./application/ports/user-block.repository.port.js";
import { BlockUserUseCase } from "./application/use-cases/block-user.use-case.js";
import { GetBlockedUsersUseCase } from "./application/use-cases/get-blocked-users.use-case.js";
import { UnblockUserUseCase } from "./application/use-cases/unblock-user.use-case.js";
import { DrizzleBlockedUserReader } from "./infrastructure/persistence/drizzle-blocked-user.reader.js";
import { DrizzleUserBlockRepository } from "./infrastructure/persistence/drizzle-user-block.repository.js";

export const SOCIAL_BLOCKS_PROVIDERS = [
  DrizzleUserBlockRepository,
  { provide: UserBlockRepositoryPort, useExisting: DrizzleUserBlockRepository },
  { provide: UserBlockReaderPort, useExisting: DrizzleUserBlockRepository },
  { provide: BlockedUserReaderPort, useClass: DrizzleBlockedUserReader },
  // 차단과 함께 끊는 친구 관계의 캐시는 friends와 같은 keyspace 어댑터로 비운다
  { provide: FollowCachePort, useClass: FollowCacheAdapter },
  provideUseCase(BlockUserUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    userBlockRepository: UserBlockRepositoryPort,
    friendshipCache: FollowCachePort,
    clock: ClockPort,
    logger: loggerFor(BlockUserUseCase),
  }),
  provideUseCase(UnblockUserUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    userBlockRepository: UserBlockRepositoryPort,
    logger: loggerFor(UnblockUserUseCase),
  }),
  provideUseCase(GetBlockedUsersUseCase, { blockedUserReader: BlockedUserReaderPort }),
] satisfies Provider[];
