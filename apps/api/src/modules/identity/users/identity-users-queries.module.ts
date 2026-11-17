import { Module } from "@nestjs/common";

import { SecurityLogRepositoryPort } from "./application/ports/security-log.repository.port.js";
import { StoreAppUserReaderPort } from "./application/ports/store-app-user.reader.port.js";
import { UserActivityReaderPort } from "./application/ports/user-activity.reader.port.js";
import { UserAiUsageCounterPort } from "./application/ports/user-ai-usage-counter.port.js";
import { UserAppVersionReaderPort } from "./application/ports/user-app-version.reader.port.js";
import { UserBriefReaderPort } from "./application/ports/user-brief.reader.port.js";
import { UserMutationLockPort } from "./application/ports/user-mutation-lock.port.js";
import { UserProfileInvalidatorPort } from "./application/ports/user-profile-invalidator.port.js";
import { UserSearchReaderPort } from "./application/ports/user-search.reader.port.js";
import { UserSignupReaderPort } from "./application/ports/user-signup.reader.port.js";
import { UserSubscriptionProjectionPort } from "./application/ports/user-subscription-projection.port.js";
import { UserRepositoryPort } from "./application/ports/user.repository.port.js";
import { UserMutationLockAdapter } from "./infrastructure/adapters/user-mutation-lock.adapter.js";
import { UserProfileCacheAdapter } from "./infrastructure/adapters/user-profile-cache.adapter.js";
import { DrizzleSecurityLogRepository } from "./infrastructure/persistence/drizzle-security-log.repository.js";
import { DrizzleStoreAppUserReader } from "./infrastructure/persistence/drizzle-store-app-user.reader.js";
import { DrizzleUserAiUsageCounterAdapter } from "./infrastructure/persistence/drizzle-user-ai-usage-counter.adapter.js";
import { DrizzleUserBriefReader } from "./infrastructure/persistence/drizzle-user-brief.reader.js";
import { DrizzleUserSearchReader } from "./infrastructure/persistence/drizzle-user-search.reader.js";
import { DrizzleUserSignupReader } from "./infrastructure/persistence/drizzle-user-signup.reader.js";
import { DrizzleUserSubscriptionProjectionAdapter } from "./infrastructure/persistence/drizzle-user-subscription-projection.adapter.js";
import { DrizzleUserRepository } from "./infrastructure/persistence/drizzle-user.repository.js";

// 다른 Context와 형제 slice(sessions·linked-accounts·verifications·oauth-states)가 쓰는 사용자 포트다.
// 아무 Module도 import하지 않아 그 Module들이 사용자 기능 Module을 거쳐 서로 순환하지 않는다.
// 사용자 저장소·보안 기록·잠금·AI 사용량·구독 projection은 쓰기 포트지만 형제 slice와 다른 Context가
// 같은 트랜잭션에서 써야 해 여기에 둔다(access feature-grants-queries의 FeatureGranterPort와 같은 예외)
@Module({
  providers: [
    { provide: UserRepositoryPort, useClass: DrizzleUserRepository },
    { provide: SecurityLogRepositoryPort, useClass: DrizzleSecurityLogRepository },
    { provide: UserMutationLockPort, useClass: UserMutationLockAdapter },
    { provide: UserProfileInvalidatorPort, useClass: UserProfileCacheAdapter },
    { provide: UserAppVersionReaderPort, useClass: DrizzleUserRepository },
    { provide: UserActivityReaderPort, useClass: DrizzleUserRepository },
    { provide: UserAiUsageCounterPort, useClass: DrizzleUserAiUsageCounterAdapter },
    { provide: UserBriefReaderPort, useClass: DrizzleUserBriefReader },
    { provide: UserSearchReaderPort, useClass: DrizzleUserSearchReader },
    { provide: UserSignupReaderPort, useClass: DrizzleUserSignupReader },
    { provide: UserSubscriptionProjectionPort, useClass: DrizzleUserSubscriptionProjectionAdapter },
    { provide: StoreAppUserReaderPort, useClass: DrizzleStoreAppUserReader },
  ],
  exports: [
    UserRepositoryPort,
    SecurityLogRepositoryPort,
    UserMutationLockPort,
    UserProfileInvalidatorPort,
    UserAppVersionReaderPort,
    UserActivityReaderPort,
    UserAiUsageCounterPort,
    UserBriefReaderPort,
    UserSearchReaderPort,
    UserSignupReaderPort,
    UserSubscriptionProjectionPort,
    StoreAppUserReaderPort,
  ],
})
export class IdentityUsersQueriesModule {}
