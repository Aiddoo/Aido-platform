import { Module, type FactoryProvider } from "@nestjs/common";

import { USER_APP_VERSION_READER } from "./application/ports/auth/user-app-version.reader.port.js";
import {
  USER_MUTATION_LOCK,
  type UserMutationLockPort,
} from "./application/ports/auth/user-mutation-lock.port.js";
import { USER_PROFILE_INVALIDATOR } from "./application/ports/auth/user-profile-invalidator.port.js";
import { AuthCacheAdapter } from "./infrastructure/adapters/auth/auth-cache.adapter.js";
import { DrizzleUserRepository } from "./infrastructure/persistence/auth/drizzle-user.repository.js";

const userMutationLockProvider: FactoryProvider<UserMutationLockPort> = {
  provide: USER_MUTATION_LOCK,
  inject: [DrizzleUserRepository],
  useFactory: (users: DrizzleUserRepository) => ({
    async lockById(userId) {
      return (await users.findByIdForUpdate(userId)) != null;
    },
  }),
};

@Module({
  providers: [
    DrizzleUserRepository,
    AuthCacheAdapter,
    userMutationLockProvider,
    { provide: USER_PROFILE_INVALIDATOR, useExisting: AuthCacheAdapter },
    { provide: USER_APP_VERSION_READER, useExisting: DrizzleUserRepository },
  ],
  exports: [USER_MUTATION_LOCK, USER_PROFILE_INVALIDATOR, USER_APP_VERSION_READER],
})
export class IdentityUserAccessModule {}
