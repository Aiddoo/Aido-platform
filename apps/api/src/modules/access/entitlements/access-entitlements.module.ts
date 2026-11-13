import { Module } from "@nestjs/common";

import { ACCESS_ENTITLEMENTS_PROVIDERS } from "./access-entitlements.providers.js";
import { AccessStateReaderPort } from "./application/ports/access-state.reader.port.js";
import { EntitlementCacheInvalidatorPort } from "./application/ports/entitlement-cache-invalidator.port.js";
import { EntitlementReaderPort } from "./application/ports/entitlement.reader.port.js";
import { FeatureGranterPort } from "./application/ports/feature-granter.port.js";

// 다른 Context가 import하는 권한 포트만 둔다. 권한 현황 컨트롤러는 social·planning을 읽어야 해서
// entitlement-usage slice에 두고, 이 모듈은 다른 Context 모듈을 import하지 않아 순환하지 않는다.
@Module({
  providers: [...ACCESS_ENTITLEMENTS_PROVIDERS],
  exports: [
    EntitlementReaderPort,
    EntitlementCacheInvalidatorPort,
    FeatureGranterPort,
    // 같은 Context의 원장(quotas)·권한 현황(entitlement-usage)이 최신 권한 상태를 읽는다
    AccessStateReaderPort,
  ],
})
export class AccessEntitlementsModule {}
