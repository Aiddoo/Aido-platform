import { Module } from "@nestjs/common";

import { AuthCacheAdapter } from "../auth/infrastructure/adapters/auth-cache.adapter.js";
import { UserActivityReaderPort } from "./application/ports/user-activity.reader.port.js";
import { UserAppVersionReaderPort } from "./application/ports/user-app-version.reader.port.js";
import { UserMutationLockPort } from "./application/ports/user-mutation-lock.port.js";
import { UserProfileInvalidatorPort } from "./application/ports/user-profile-invalidator.port.js";
import { UserMutationLockAdapter } from "./infrastructure/adapters/user-mutation-lock.adapter.js";
import { DrizzleUserRepository } from "./infrastructure/persistence/drizzle-user.repository.js";

// access·billing·ai·notification·planning이 import하는 사용자 포트만 둔다. 이 모듈은 다른 Context
// 모듈을 import하지 않아 IdentityUsersModule → IdentityAuthModule → Access·Billing → 여기로 순환하지 않는다.
// 옛 Symbol 토큰은 소비 Context가 옮길 때까지 클래스 토큰과 같은 인스턴스를 가리킨다.
@Module({
  providers: [
    DrizzleUserRepository,
    AuthCacheAdapter,
    { provide: UserMutationLockPort, useClass: UserMutationLockAdapter },
    { provide: UserProfileInvalidatorPort, useExisting: AuthCacheAdapter },
    { provide: UserAppVersionReaderPort, useExisting: DrizzleUserRepository },
    { provide: UserActivityReaderPort, useExisting: DrizzleUserRepository },
  ],
  exports: [
    DrizzleUserRepository,
    AuthCacheAdapter,
    UserMutationLockPort,
    UserProfileInvalidatorPort,
    UserAppVersionReaderPort,
    UserActivityReaderPort,
  ],
})
export class IdentityUserAccessModule {}
