import type { Provider } from "@nestjs/common";

import { provideUseCase } from "#api/platform/di/provide-use-case";
import { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import { AccessStateReaderPort } from "./application/ports/access-state.reader.port.js";
import {
  ENTITLEMENT_SUBSCRIPTION_INVALIDATOR,
  EntitlementSubscriptionInvalidatorPort,
} from "./application/ports/entitlement-cache-invalidator.port.js";
import { EntitlementCachePort } from "./application/ports/entitlement-cache.port.js";
import {
  ENTITLEMENT_READER,
  EntitlementReaderPort,
} from "./application/ports/entitlement.reader.port.js";
import {
  RESOURCE_BONUS_GRANTER,
  ResourceBonusGranterPort,
} from "./application/ports/resource-bonus-granter.port.js";
import { ResourceBonusRepositoryPort } from "./application/ports/resource-bonus.repository.port.js";
import { GetResolvedAccessUseCase } from "./application/use-cases/get-resolved-access.use-case.js";
import { GrantResourceBonusUseCase } from "./application/use-cases/grant-resource-bonus.use-case.js";
import { EntitlementCacheAdapter } from "./infrastructure/adapters/entitlement-cache.adapter.js";
import { EntitlementReaderAdapter } from "./infrastructure/adapters/entitlement-reader.adapter.js";
import { ResourceBonusGranterAdapter } from "./infrastructure/adapters/resource-bonus-granter.adapter.js";
import { DrizzleAccessStateReader } from "./infrastructure/persistence/drizzle-access-state.reader.js";
import { DrizzleResourceBonusRepository } from "./infrastructure/persistence/drizzle-resource-bonus.repository.js";

export const ACCESS_ENTITLEMENTS_PROVIDERS = [
  { provide: AccessStateReaderPort, useClass: DrizzleAccessStateReader },
  { provide: ResourceBonusRepositoryPort, useClass: DrizzleResourceBonusRepository },
  { provide: EntitlementCachePort, useClass: EntitlementCacheAdapter },
  // 권한 캐시 비우기는 같은 key를 쓰므로 캐시 포트와 같은 인스턴스다
  { provide: EntitlementSubscriptionInvalidatorPort, useExisting: EntitlementCachePort },
  { provide: EntitlementReaderPort, useClass: EntitlementReaderAdapter },
  { provide: ResourceBonusGranterPort, useClass: ResourceBonusGranterAdapter },
  // 옛 Symbol 토큰은 소비 Context가 옮길 때까지 클래스 토큰과 같은 인스턴스를 가리킨다
  { provide: ENTITLEMENT_READER, useExisting: EntitlementReaderPort },
  {
    provide: ENTITLEMENT_SUBSCRIPTION_INVALIDATOR,
    useExisting: EntitlementSubscriptionInvalidatorPort,
  },
  { provide: RESOURCE_BONUS_GRANTER, useExisting: ResourceBonusGranterPort },
  provideUseCase(GetResolvedAccessUseCase, {
    accessStateReader: AccessStateReaderPort,
    entitlementCache: EntitlementCachePort,
    clock: ClockPort,
  }),
  provideUseCase(GrantResourceBonusUseCase, {
    resourceBonusRepository: ResourceBonusRepositoryPort,
    entitlementCache: EntitlementCachePort,
    afterCommit: AfterCommitTaskRegistryPort,
    clock: ClockPort,
  }),
] satisfies Provider[];
