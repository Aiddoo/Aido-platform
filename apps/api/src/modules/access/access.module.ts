import { Module } from "@nestjs/common";

import { AccessFeatureGrantsQueriesModule } from "./feature-grants/access-feature-grants-queries.module.js";
import { AccessFeatureGrantsModule } from "./feature-grants/access-feature-grants.module.js";
import { AccessQuotaChargesModule } from "./quota-charges/access-quota-charges.module.js";

@Module({
  imports: [AccessFeatureGrantsQueriesModule, AccessQuotaChargesModule, AccessFeatureGrantsModule],
  exports: [AccessFeatureGrantsQueriesModule, AccessQuotaChargesModule],
})
export class AccessModule {}
