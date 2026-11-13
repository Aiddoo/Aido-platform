import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HttpClientModule } from "@nestjs/http-client";

import { IdentityUserAccessModule } from "#api/modules/identity/users/identity-users.public";
import { NotificationPushModule } from "#api/modules/notification/notification-delivery.public";
import { OperationsAdminNoticesModule } from "#api/modules/operations/admin-notices/operations-admin-notices.public";

import { BillingPremiumGrantsModule } from "../premium-grants/billing-premium-grants.module.js";
import { billingSubscriptionsConfig } from "./billing-subscriptions.config.js";
import { BILLING_SUBSCRIPTIONS_PROVIDERS } from "./billing-subscriptions.providers.js";
import {
  REVENUECAT_HTTP_CLIENT,
  REVENUECAT_TIMEOUT_MS,
} from "./infrastructure/adapters/revenuecat/revenuecat-store-subscription-status.adapter.js";
import { RevenueCatWebhookController } from "./presentation/http/v1/revenuecat-webhook.controller.js";

@Module({
  imports: [
    BillingPremiumGrantsModule,
    IdentityUserAccessModule,
    OperationsAdminNoticesModule,
    NotificationPushModule,
    ConfigModule.forFeature(billingSubscriptionsConfig),
    HttpClientModule.register({
      name: REVENUECAT_HTTP_CLIENT,
      retry: false,
      throwOnHttpError: false,
      timeout: REVENUECAT_TIMEOUT_MS,
    }),
  ],
  controllers: [RevenueCatWebhookController],
  providers: [...BILLING_SUBSCRIPTIONS_PROVIDERS],
})
export class BillingSubscriptionsModule {}
