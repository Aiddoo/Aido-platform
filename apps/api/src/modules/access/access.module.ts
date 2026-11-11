import { Module } from "@nestjs/common";

import { AccessEntitlementSnapshotModule } from "./entitlements/access-entitlement-snapshot.module.js";
import { AccessEntitlementsModule } from "./entitlements/access-entitlements.module.js";
import { AccessQuotasModule } from "./quotas/access-quotas.module.js";

@Module({
  imports: [AccessEntitlementsModule, AccessQuotasModule, AccessEntitlementSnapshotModule],
  exports: [AccessEntitlementsModule, AccessQuotasModule],
})
export class AccessModule {}
