import { Module } from "@nestjs/common";

import { AuthCacheAdapter } from "../auth/infrastructure/adapters/auth-cache.adapter.js";
import { UserActivityReaderPort } from "./application/ports/user-activity.reader.port.js";
import { UserAiUsageCounterPort } from "./application/ports/user-ai-usage-counter.port.js";
import { UserAppVersionReaderPort } from "./application/ports/user-app-version.reader.port.js";
import { UserBriefReaderPort } from "./application/ports/user-brief.reader.port.js";
import { UserMutationLockPort } from "./application/ports/user-mutation-lock.port.js";
import { UserProfileInvalidatorPort } from "./application/ports/user-profile-invalidator.port.js";
import { UserSearchReaderPort } from "./application/ports/user-search.reader.port.js";
import { UserSignupReaderPort } from "./application/ports/user-signup.reader.port.js";
import { UserSubscriptionProjectionPort } from "./application/ports/user-subscription-projection.port.js";
import { UserMutationLockAdapter } from "./infrastructure/adapters/user-mutation-lock.adapter.js";
import { DrizzleUserAiUsageCounterAdapter } from "./infrastructure/persistence/drizzle-user-ai-usage-counter.adapter.js";
import { DrizzleUserBriefReader } from "./infrastructure/persistence/drizzle-user-brief.reader.js";
import { DrizzleUserSearchReader } from "./infrastructure/persistence/drizzle-user-search.reader.js";
import { DrizzleUserSignupReader } from "./infrastructure/persistence/drizzle-user-signup.reader.js";
import { DrizzleUserSubscriptionProjectionAdapter } from "./infrastructure/persistence/drizzle-user-subscription-projection.adapter.js";
import { DrizzleUserRepository } from "./infrastructure/persistence/drizzle-user.repository.js";

// access·billing·ai·notification·planning·social·operations가 import하는 사용자 포트만 둔다. 이 모듈은 다른 Context
// 모듈을 import하지 않아 IdentityUsersModule → IdentityAuthModule → Access·Billing → 여기로 순환하지 않는다.
@Module({
  providers: [
    DrizzleUserRepository,
    AuthCacheAdapter,
    { provide: UserMutationLockPort, useClass: UserMutationLockAdapter },
    { provide: UserProfileInvalidatorPort, useExisting: AuthCacheAdapter },
    { provide: UserAppVersionReaderPort, useExisting: DrizzleUserRepository },
    { provide: UserActivityReaderPort, useExisting: DrizzleUserRepository },
    { provide: UserAiUsageCounterPort, useClass: DrizzleUserAiUsageCounterAdapter },
    { provide: UserBriefReaderPort, useClass: DrizzleUserBriefReader },
    { provide: UserSearchReaderPort, useClass: DrizzleUserSearchReader },
    { provide: UserSignupReaderPort, useClass: DrizzleUserSignupReader },
    { provide: UserSubscriptionProjectionPort, useClass: DrizzleUserSubscriptionProjectionAdapter },
  ],
  exports: [
    DrizzleUserRepository,
    AuthCacheAdapter,
    UserMutationLockPort,
    UserProfileInvalidatorPort,
    UserAppVersionReaderPort,
    UserActivityReaderPort,
    UserAiUsageCounterPort,
    UserBriefReaderPort,
    UserSearchReaderPort,
    UserSignupReaderPort,
    UserSubscriptionProjectionPort,
  ],
})
export class IdentityUserAccessModule {}
