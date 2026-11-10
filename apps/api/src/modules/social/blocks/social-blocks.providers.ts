import { Logger, type FactoryProvider } from "@nestjs/common";

import { PaginationService } from "#api/shared/application/pagination/index";
import { MUTATION_LOCK, UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { FOLLOW_CACHE } from "../friends/application/ports/follow-cache.port.js";
import { USER_BLOCK_REPOSITORY } from "./application/ports/user-block.repository.port.js";
import { BlockUserUseCase } from "./application/use-cases/block-user.use-case.js";
import { GetBlockedUsersUseCase } from "./application/use-cases/get-blocked-users.use-case.js";
import { UnblockUserUseCase } from "./application/use-cases/unblock-user.use-case.js";

export const blockUserProvider: FactoryProvider<BlockUserUseCase> = {
  provide: BlockUserUseCase,
  inject: [USER_BLOCK_REPOSITORY, UNIT_OF_WORK, MUTATION_LOCK, FOLLOW_CACHE],
  useFactory: (
    userBlockRepository: ConstructorParameters<typeof BlockUserUseCase>[0]["userBlockRepository"],
    unitOfWork: ConstructorParameters<typeof BlockUserUseCase>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof BlockUserUseCase>[0]["mutationLock"],
    friendshipCache: ConstructorParameters<typeof BlockUserUseCase>[0]["friendshipCache"],
  ) =>
    new BlockUserUseCase({
      userBlockRepository,
      unitOfWork,
      mutationLock,
      friendshipCache,
      logger: new Logger(BlockUserUseCase.name),
    }),
};

export const unblockUserProvider: FactoryProvider<UnblockUserUseCase> = {
  provide: UnblockUserUseCase,
  inject: [USER_BLOCK_REPOSITORY, UNIT_OF_WORK, MUTATION_LOCK],
  useFactory: (
    userBlockRepository: ConstructorParameters<typeof UnblockUserUseCase>[0]["userBlockRepository"],
    unitOfWork: ConstructorParameters<typeof UnblockUserUseCase>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof UnblockUserUseCase>[0]["mutationLock"],
  ) =>
    new UnblockUserUseCase({
      userBlockRepository,
      unitOfWork,
      mutationLock,
      logger: new Logger(UnblockUserUseCase.name),
    }),
};

export const getBlockedUsersProvider: FactoryProvider<GetBlockedUsersUseCase> = {
  provide: GetBlockedUsersUseCase,
  inject: [USER_BLOCK_REPOSITORY, PaginationService],
  useFactory: (
    userBlockRepository: ConstructorParameters<
      typeof GetBlockedUsersUseCase
    >[0]["userBlockRepository"],
    paginationService: ConstructorParameters<typeof GetBlockedUsersUseCase>[0]["paginationService"],
  ) => new GetBlockedUsersUseCase({ userBlockRepository, paginationService }),
};
