import { Module } from "@nestjs/common";

import { ACCESS_ENTITLEMENTS_PROVIDERS } from "./access-entitlements.providers.js";
import { AccessStateReaderPort } from "./application/ports/access-state.reader.port.js";
import {
  ENTITLEMENT_SUBSCRIPTION_INVALIDATOR,
  EntitlementSubscriptionInvalidatorPort,
} from "./application/ports/entitlement-cache-invalidator.port.js";
import {
  ENTITLEMENT_READER,
  EntitlementReaderPort,
} from "./application/ports/entitlement.reader.port.js";
import {
  RESOURCE_BONUS_GRANTER,
  ResourceBonusGranterPort,
} from "./application/ports/resource-bonus-granter.port.js";

// 다른 Context가 import하는 권한 포트만 둔다. 권한 스냅샷 컨트롤러는 social·planning을 읽어야 해서
// AccessEntitlementSnapshotModule에 두고, 이 모듈은 다른 Context 모듈을 import하지 않아 순환하지 않는다.
@Module({
  providers: [...ACCESS_ENTITLEMENTS_PROVIDERS],
  exports: [
    EntitlementReaderPort,
    EntitlementSubscriptionInvalidatorPort,
    ResourceBonusGranterPort,
    ENTITLEMENT_READER,
    ENTITLEMENT_SUBSCRIPTION_INVALIDATOR,
    RESOURCE_BONUS_GRANTER,
    // 같은 Context의 원장·스냅샷이 최신 권한 상태를 읽는다
    AccessStateReaderPort,
  ],
})
export class AccessEntitlementsModule {}
