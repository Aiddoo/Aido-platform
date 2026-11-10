import { Module } from "@nestjs/common";

import {
  entitlementReaderAdapterProvider,
  resourceBonusGranterProvider,
} from "./access-entitlements.providers.js";
import { ACCESS_STATE_READER } from "./application/ports/access-state.reader.port.js";
import { ENTITLEMENT_SUBSCRIPTION_INVALIDATOR } from "./application/ports/entitlement-cache-invalidator.port.js";
import { ENTITLEMENT_CACHE } from "./application/ports/entitlement-cache.port.js";
import { ENTITLEMENT_READER } from "./application/ports/entitlement.reader.port.js";
import { RESOURCE_BONUS_GRANTER } from "./application/ports/resource-bonus-granter.port.js";
import { RESOURCE_BONUS_REPOSITORY } from "./application/ports/resource-bonus.repository.port.js";
import { ResourceBonusGranter } from "./application/use-cases/grant-resource-bonus.use-case.js";
import { EntitlementCacheAdapter } from "./infrastructure/adapters/entitlement-cache.adapter.js";
import { EntitlementReaderAdapter } from "./infrastructure/adapters/entitlement-reader.adapter.js";
import { DrizzleAccessStateReader } from "./infrastructure/persistence/drizzle-access-state.reader.js";
import { DrizzleResourceBonusRepository } from "./infrastructure/persistence/drizzle-resource-bonus.repository.js";

// 다른 Context가 import하는 권한 포트만 둔다. 권한 스냅샷 컨트롤러는 social·planning을 읽어야 해서
// AccessEntitlementSnapshotModule에 두고, 이 모듈은 다른 Context 모듈을 import하지 않아 순환하지 않는다.
@Module({
  providers: [
    entitlementReaderAdapterProvider,
    DrizzleAccessStateReader,
    EntitlementCacheAdapter,
    { provide: ENTITLEMENT_READER, useExisting: EntitlementReaderAdapter },
    { provide: ENTITLEMENT_SUBSCRIPTION_INVALIDATOR, useExisting: EntitlementCacheAdapter },
    { provide: ENTITLEMENT_CACHE, useExisting: EntitlementCacheAdapter },
    { provide: ACCESS_STATE_READER, useExisting: DrizzleAccessStateReader },
    { provide: RESOURCE_BONUS_REPOSITORY, useClass: DrizzleResourceBonusRepository },
    resourceBonusGranterProvider,
    { provide: RESOURCE_BONUS_GRANTER, useExisting: ResourceBonusGranter },
  ],
  exports: [
    ENTITLEMENT_READER,
    ENTITLEMENT_SUBSCRIPTION_INVALIDATOR,
    RESOURCE_BONUS_GRANTER,
    ACCESS_STATE_READER,
  ],
})
export class AccessEntitlementsModule {}
