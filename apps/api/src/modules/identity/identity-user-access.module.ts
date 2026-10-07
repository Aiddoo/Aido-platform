import { Module, type FactoryProvider } from "@nestjs/common";

import {
  USER_MUTATION_LOCK,
  type UserMutationLockPort,
} from "./application/ports/auth/user-mutation-lock.port.js";
import { USER_PROFILE_INVALIDATOR } from "./application/ports/auth/user-profile-invalidator.port.js";
import { AuthCacheAdapter } from "./infrastructure/adapters/auth/auth-cache.adapter.js";
import { UserRepository } from "./infrastructure/persistence/auth/user.repository.js";

const userMutationLockProvider: FactoryProvider<UserMutationLockPort> = {
  provide: USER_MUTATION_LOCK,
  inject: [UserRepository],
  useFactory: (users: UserRepository) => ({
    async lockById(userId) {
      return (await users.findByIdForUpdate(userId)) !== null;
    },
  }),
};

@Module({
  providers: [
    UserRepository,
    AuthCacheAdapter,
    userMutationLockProvider,
    { provide: USER_PROFILE_INVALIDATOR, useExisting: AuthCacheAdapter },
  ],
  exports: [USER_MUTATION_LOCK, USER_PROFILE_INVALIDATOR],
})
export class IdentityUserAccessModule {}
