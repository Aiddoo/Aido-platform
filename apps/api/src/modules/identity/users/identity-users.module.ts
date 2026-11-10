import { Module } from "@nestjs/common";

import { AuthCacheAdapter } from "../auth/infrastructure/adapters/auth-cache.adapter.js";
import {
  USER_ACTIVITY_READER,
  UserActivityReaderPort,
} from "./application/ports/user-activity.reader.port.js";
import {
  USER_APP_VERSION_READER,
  UserAppVersionReaderPort,
} from "./application/ports/user-app-version.reader.port.js";
import {
  USER_MUTATION_LOCK,
  UserMutationLockPort,
} from "./application/ports/user-mutation-lock.port.js";
import {
  USER_PROFILE_INVALIDATOR,
  UserProfileInvalidatorPort,
} from "./application/ports/user-profile-invalidator.port.js";
import { UserMutationLockAdapter } from "./infrastructure/adapters/user-mutation-lock.adapter.js";
import { DrizzleUserRepository } from "./infrastructure/persistence/drizzle-user.repository.js";

// 옛 Symbol 토큰은 access·billing·ai·notification이 옮길 때까지 클래스 토큰과 같은 인스턴스를 가리킨다
@Module({
  providers: [
    DrizzleUserRepository,
    AuthCacheAdapter,
    { provide: UserMutationLockPort, useClass: UserMutationLockAdapter },
    { provide: USER_MUTATION_LOCK, useExisting: UserMutationLockPort },
    { provide: UserProfileInvalidatorPort, useExisting: AuthCacheAdapter },
    { provide: USER_PROFILE_INVALIDATOR, useExisting: UserProfileInvalidatorPort },
    { provide: UserAppVersionReaderPort, useExisting: DrizzleUserRepository },
    { provide: USER_APP_VERSION_READER, useExisting: UserAppVersionReaderPort },
    { provide: UserActivityReaderPort, useExisting: DrizzleUserRepository },
    { provide: USER_ACTIVITY_READER, useExisting: UserActivityReaderPort },
  ],
  exports: [
    UserMutationLockPort,
    USER_MUTATION_LOCK,
    UserProfileInvalidatorPort,
    USER_PROFILE_INVALIDATOR,
    UserAppVersionReaderPort,
    USER_APP_VERSION_READER,
    UserActivityReaderPort,
    USER_ACTIVITY_READER,
  ],
})
export class IdentityUsersModule {}
