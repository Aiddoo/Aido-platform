import { Module } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-entitlement.public";
import {
  IdentityUserAccessModule,
  USER_MUTATION_LOCK,
} from "#api/modules/identity/identity-user-access.public";
import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";
import { OperationsNotificationsModule } from "#api/modules/operations/operations-notifications.public";

import { PREMIUM_ACCESS_READER } from "./application/ports/subscriptions/premium-access.reader.port.js";
import { PREMIUM_GRANT_NOTIFIER } from "./application/ports/subscriptions/premium-grant-notifier.port.js";
import { PREMIUM_GRANT_REPOSITORY } from "./application/ports/subscriptions/premium-grant.repository.port.js";
import { PREMIUM_GRANTER } from "./application/ports/subscriptions/premium-granter.port.js";
import { SUBSCRIPTION_CACHE } from "./application/ports/subscriptions/subscription-cache.port.js";
import { SUBSCRIPTION_EVENT_NOTIFIER } from "./application/ports/subscriptions/subscription-event-notifier.port.js";
import { SUBSCRIPTION_EVENT_RECEIPT_REPOSITORY } from "./application/ports/subscriptions/subscription-event-receipt.repository.port.js";
import { SUBSCRIPTION_USER_MUTATION_LOCK } from "./application/ports/subscriptions/subscription-user-mutation-lock.port.js";
import { SUBSCRIPTION_WEBHOOK_LOCK } from "./application/ports/subscriptions/subscription-webhook-lock.port.js";
import { SUBSCRIPTION_REPOSITORY } from "./application/ports/subscriptions/subscription.repository.port.js";
import { PremiumAccessReader } from "./application/services/subscriptions/premium-access-reader.service.js";
import { PremiumGranter } from "./application/services/subscriptions/premium-granter.service.js";
import {
  handleWebhookEventProvider,
  notifyEndingPremiumGrantsProvider,
  premiumAccessProjectorProvider,
  premiumAccessReaderProvider,
  premiumGranterProvider,
  sweepPremiumGrantsProvider,
} from "./billing-subscriptions-application.providers.js";
import { PremiumGrantNotifierAdapter } from "./infrastructure/adapters/subscriptions/premium-grant-notifier.adapter.js";
import { SubscriptionCacheAdapter } from "./infrastructure/adapters/subscriptions/subscription-cache.adapter.js";
import { SubscriptionEventNotifierAdapter } from "./infrastructure/adapters/subscriptions/subscription-event-notifier.adapter.js";
import { SubscriptionWebhookLockAdapter } from "./infrastructure/adapters/subscriptions/subscription-webhook-lock.adapter.js";
import { WebhookSignatureGuard } from "./infrastructure/guards/subscriptions/webhook-signature.guard.js";
import { PremiumGrantSweepJob } from "./infrastructure/jobs/subscriptions/premium-grant-sweep.job.js";
import { PremiumGrantSweepProcessor } from "./infrastructure/jobs/subscriptions/premium-grant-sweep.processor.js";
import { PrismaPremiumGrantRepository } from "./infrastructure/persistence/subscriptions/prisma-premium-grant.repository.js";
import { PrismaSubscriptionEventReceiptRepository } from "./infrastructure/persistence/subscriptions/prisma-subscription-event-receipt.repository.js";
import { PrismaSubscriptionRepository } from "./infrastructure/persistence/subscriptions/prisma-subscription.repository.js";
import { SubscriptionController } from "./presentation/controllers/subscriptions/subscription.controller.js";

@Module({
  imports: [
    IdentityUserAccessModule,
    AccessModule,
    OperationsNotificationsModule,
    NotificationDeliveryModule,
  ],
  controllers: [SubscriptionController],
  providers: [
    handleWebhookEventProvider,
    { provide: SUBSCRIPTION_USER_MUTATION_LOCK, useExisting: USER_MUTATION_LOCK },
    {
      provide: SUBSCRIPTION_EVENT_RECEIPT_REPOSITORY,
      useClass: PrismaSubscriptionEventReceiptRepository,
    },
    WebhookSignatureGuard,
    {
      provide: SUBSCRIPTION_REPOSITORY,
      useClass: PrismaSubscriptionRepository,
    },
    { provide: SUBSCRIPTION_CACHE, useClass: SubscriptionCacheAdapter },
    {
      provide: SUBSCRIPTION_EVENT_NOTIFIER,
      useClass: SubscriptionEventNotifierAdapter,
    },
    {
      provide: SUBSCRIPTION_WEBHOOK_LOCK,
      useClass: SubscriptionWebhookLockAdapter,
    },
    { provide: PREMIUM_GRANT_REPOSITORY, useClass: PrismaPremiumGrantRepository },
    { provide: PREMIUM_GRANT_NOTIFIER, useClass: PremiumGrantNotifierAdapter },
    premiumAccessProjectorProvider,
    premiumAccessReaderProvider,
    premiumGranterProvider,
    sweepPremiumGrantsProvider,
    notifyEndingPremiumGrantsProvider,
    { provide: PREMIUM_GRANTER, useExisting: PremiumGranter },
    { provide: PREMIUM_ACCESS_READER, useExisting: PremiumAccessReader },
    PremiumGrantSweepJob,
    PremiumGrantSweepProcessor,
  ],
  exports: [PREMIUM_GRANTER, PREMIUM_ACCESS_READER],
})
export class BillingSubscriptionsModule {}
