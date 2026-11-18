import { Module } from "@nestjs/common";

import { provideUseCase } from "#api/platform/di/provide-use-case";
import { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import { AccessStateReaderPort } from "./application/ports/access-state.reader.port.js";
import { EntitlementCacheInvalidatorPort } from "./application/ports/entitlement-cache-invalidator.port.js";
import { EntitlementCachePort } from "./application/ports/entitlement-cache.port.js";
import { EntitlementReaderPort } from "./application/ports/entitlement.reader.port.js";
import { FeatureGrantRepositoryPort } from "./application/ports/feature-grant.repository.port.js";
import { FeatureGranterPort } from "./application/ports/feature-granter.port.js";
import { GetResolvedAccessUseCase } from "./application/use-cases/get-resolved-access.use-case.js";
import { GrantFeatureUseCase } from "./application/use-cases/grant-feature.use-case.js";
import { EntitlementCacheAdapter } from "./infrastructure/adapters/entitlement-cache.adapter.js";
import { EntitlementReaderAdapter } from "./infrastructure/adapters/entitlement-reader.adapter.js";
import { FeatureGranterAdapter } from "./infrastructure/adapters/feature-granter.adapter.js";
import { DrizzleAccessStateReader } from "./infrastructure/persistence/drizzle-access-state.reader.js";
import { DrizzleFeatureGrantRepository } from "./infrastructure/persistence/drizzle-feature-grant.repository.js";

// 다른 Context가 쓰는 권한 판단·자리 지급 포트만 둔다. 권한 현황 Module은 social·planning·원장 Module을
// import하고 그쪽이 이 포트를 쓰므로, 이 Module과 조립은 다른 Module을 import하지 않아 순환하지 않는다
@Module({
  providers: [
    { provide: AccessStateReaderPort, useClass: DrizzleAccessStateReader },
    { provide: FeatureGrantRepositoryPort, useClass: DrizzleFeatureGrantRepository },
    { provide: EntitlementCachePort, useClass: EntitlementCacheAdapter },
    // 권한 캐시 비우기는 같은 key를 쓰므로 캐시 포트와 같은 인스턴스다
    { provide: EntitlementCacheInvalidatorPort, useExisting: EntitlementCachePort },
    { provide: EntitlementReaderPort, useClass: EntitlementReaderAdapter },
    { provide: FeatureGranterPort, useClass: FeatureGranterAdapter },
    provideUseCase(GetResolvedAccessUseCase, {
      accessStateReader: AccessStateReaderPort,
      entitlementCache: EntitlementCachePort,
      clock: ClockPort,
    }),
    provideUseCase(GrantFeatureUseCase, {
      featureGrantRepository: FeatureGrantRepositoryPort,
      entitlementCache: EntitlementCachePort,
      afterCommit: AfterCommitTaskRegistryPort,
      clock: ClockPort,
    }),
  ],
  exports: [
    EntitlementReaderPort,
    EntitlementCacheInvalidatorPort,
    FeatureGranterPort,
    // 같은 Context의 원장(quota-charges)이 잠금 안에서 최신 권한 상태를 읽는다
    AccessStateReaderPort,
  ],
})
export class AccessFeatureGrantsQueriesModule {}
