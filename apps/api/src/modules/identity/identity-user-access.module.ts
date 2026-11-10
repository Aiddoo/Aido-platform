import { Module, type FactoryProvider } from "@nestjs/common";

import { USER_ACTIVITY_READER } from "./auth/application/ports/user-activity.reader.port.js";
import { USER_APP_VERSION_READER } from "./auth/application/ports/user-app-version.reader.port.js";
import {
  USER_MUTATION_LOCK,
  type UserMutationLockPort,
} from "./auth/application/ports/user-mutation-lock.port.js";
import { USER_PROFILE_INVALIDATOR } from "./auth/application/ports/user-profile-invalidator.port.js";
import { AuthCacheAdapter } from "./auth/infrastructure/adapters/auth-cache.adapter.js";
import { DrizzleUserRepository } from "./auth/infrastructure/persistence/drizzle-user.repository.js";

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
    { provide: USER_ACTIVITY_READER, useExisting: DrizzleUserRepository },
  ],
  exports: [
    USER_MUTATION_LOCK,
    USER_PROFILE_INVALIDATOR,
    USER_APP_VERSION_READER,
    USER_ACTIVITY_READER,
  ],
})
export class IdentityUserAccessModule {}
