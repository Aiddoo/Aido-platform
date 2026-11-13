import { Module } from "@nestjs/common";

import { AccessEntitlementUsageModule } from "./entitlement-usage/access-entitlement-usage.module.js";
import { AccessEntitlementsModule } from "./entitlements/access-entitlements.module.js";
import { AccessQuotasModule } from "./quotas/access-quotas.module.js";

@Module({
  imports: [AccessEntitlementsModule, AccessQuotasModule, AccessEntitlementUsageModule],
  exports: [AccessEntitlementsModule, AccessQuotasModule],
})
export class AccessModule {}
