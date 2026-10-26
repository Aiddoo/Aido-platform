import { Logger, type FactoryProvider } from "@nestjs/common";

import { PaginationService } from "#api/shared/application/pagination/index";
import { MUTATION_LOCK, UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { USER_BLOCK_REPOSITORY } from "./application/ports/blocks/user-block.repository.port.js";
import { FOLLOW_CACHE } from "./application/ports/friends/follow-cache.port.js";
import { BlockUser } from "./application/use-cases/blocks/block-user.use-case.js";
import { GetBlockedUsers } from "./application/use-cases/blocks/get-blocked-users.use-case.js";
import { UnblockUser } from "./application/use-cases/blocks/unblock-user.use-case.js";

export const blockUserProvider: FactoryProvider<BlockUser> = {
  provide: BlockUser,
  inject: [USER_BLOCK_REPOSITORY, UNIT_OF_WORK, MUTATION_LOCK, FOLLOW_CACHE],
  useFactory: (
    userBlockRepository: ConstructorParameters<typeof BlockUser>[0]["userBlockRepository"],
    unitOfWork: ConstructorParameters<typeof BlockUser>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof BlockUser>[0]["mutationLock"],
    friendshipCache: ConstructorParameters<typeof BlockUser>[0]["friendshipCache"],
  ) =>
    new BlockUser({
      userBlockRepository,
      unitOfWork,
      mutationLock,
      friendshipCache,
      logger: new Logger(BlockUser.name),
    }),
};

export const unblockUserProvider: FactoryProvider<UnblockUser> = {
  provide: UnblockUser,
  inject: [USER_BLOCK_REPOSITORY, UNIT_OF_WORK, MUTATION_LOCK],
  useFactory: (
    userBlockRepository: ConstructorParameters<typeof UnblockUser>[0]["userBlockRepository"],
    unitOfWork: ConstructorParameters<typeof UnblockUser>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof UnblockUser>[0]["mutationLock"],
  ) =>
    new UnblockUser({
      userBlockRepository,
      unitOfWork,
      mutationLock,
      logger: new Logger(UnblockUser.name),
    }),
};

export const getBlockedUsersProvider: FactoryProvider<GetBlockedUsers> = {
  provide: GetBlockedUsers,
  inject: [USER_BLOCK_REPOSITORY, PaginationService],
  useFactory: (
    userBlockRepository: ConstructorParameters<typeof GetBlockedUsers>[0]["userBlockRepository"],
    paginationService: ConstructorParameters<typeof GetBlockedUsers>[0]["paginationService"],
  ) => new GetBlockedUsers({ userBlockRepository, paginationService }),
};
