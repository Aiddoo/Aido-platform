import { Module } from "@nestjs/common";

import { BillingPremiumGrantsModule } from "./premium-grants/billing-premium-grants.module.js";
import { BillingSubscriptionsModule } from "./subscriptions/billing-subscriptions.module.js";

@Module({
  imports: [BillingPremiumGrantsModule, BillingSubscriptionsModule],
  exports: [BillingPremiumGrantsModule, BillingSubscriptionsModule],
})
export class BillingModule {}
