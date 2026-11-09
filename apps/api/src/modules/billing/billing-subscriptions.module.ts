import { Module } from "@nestjs/common";
import { HttpClientModule } from "@nestjs/http-client";

import { AccessModule } from "#api/modules/access/access-entitlement.public";
import {
  IdentityUserAccessModule,
  USER_MUTATION_LOCK,
} from "#api/modules/identity/identity-user-access.public";
import {
  NotificationDeliveryModule,
  PUSH_QUIET_HOURS_READER,
  type PushQuietHoursReaderPort,
} from "#api/modules/notification/notification-delivery.public";
import { OperationsNotificationsModule } from "#api/modules/operations/operations-notifications.public";

import { PREMIUM_ACCESS_READER } from "./application/ports/subscriptions/premium-access.reader.port.js";
import { PREMIUM_GRANT_ENDING_NOTICE_SOURCE } from "./application/ports/subscriptions/premium-grant-ending-notice.source.port.js";
import { PREMIUM_GRANT_NOTIFIER } from "./application/ports/subscriptions/premium-grant-notifier.port.js";
import { PREMIUM_GRANT_REPOSITORY } from "./application/ports/subscriptions/premium-grant.repository.port.js";
import { PREMIUM_GRANTER } from "./application/ports/subscriptions/premium-granter.port.js";
import {
  QUIET_HOURS_READER,
  type QuietHoursReaderPort,
} from "./application/ports/subscriptions/quiet-hours.reader.port.js";
import { STORE_SUBSCRIPTION_RECONCILE_SCHEDULER } from "./application/ports/subscriptions/store-subscription-reconcile.scheduler.port.js";
import { STORE_SUBSCRIPTION_STATUS_READER } from "./application/ports/subscriptions/store-subscription-status.reader.port.js";
import { SUBSCRIPTION_CACHE } from "./application/ports/subscriptions/subscription-cache.port.js";
import { SUBSCRIPTION_EVENT_NOTIFIER } from "./application/ports/subscriptions/subscription-event-notifier.port.js";
import { SUBSCRIPTION_EVENT_RECEIPT_REPOSITORY } from "./application/ports/subscriptions/subscription-event-receipt.repository.port.js";
import { SUBSCRIPTION_USER_MUTATION_LOCK } from "./application/ports/subscriptions/subscription-user-mutation-lock.port.js";
import { SUBSCRIPTION_WEBHOOK_LOCK } from "./application/ports/subscriptions/subscription-webhook-lock.port.js";
import { SUBSCRIPTION_REPOSITORY } from "./application/ports/subscriptions/subscription.repository.port.js";
import { TRIAL_ENDING_NOTICE_SOURCE } from "./application/ports/subscriptions/trial-ending-notice.source.port.js";
import { TRIAL_ENDING_NOTIFIER } from "./application/ports/subscriptions/trial-ending-notifier.port.js";
import { UPCOMING_RENEWAL_NOTICE_SOURCE } from "./application/ports/subscriptions/upcoming-renewal-notice.source.port.js";
import { UPCOMING_RENEWAL_NOTIFIER } from "./application/ports/subscriptions/upcoming-renewal-notifier.port.js";
import { PremiumAccessReader } from "./application/services/subscriptions/premium-access-reader.service.js";
import { PremiumGranter } from "./application/services/subscriptions/premium-granter.service.js";
import {
  billingNoticeSweeperProvider,
  applyStoreSubscriptionEventProvider,
  notifyEndingPremiumGrantsProvider,
  notifyEndingTrialsProvider,
  notifyUpcomingRenewalsProvider,
  premiumAccessProjectorProvider,
  premiumAccessReaderProvider,
  premiumGranterProvider,
  reconcileStoreSubscriptionsProvider,
  sweepPremiumGrantsProvider,
  revokePremiumGrantProvider,
} from "./billing-subscriptions-application.providers.js";
import { PremiumGrantNotifierAdapter } from "./infrastructure/adapters/subscriptions/premium-grant-notifier.adapter.js";
import {
  REVENUECAT_HTTP_CLIENT,
  REVENUECAT_TIMEOUT_MS,
  RevenueCatStoreSubscriptionStatusReader,
} from "./infrastructure/adapters/subscriptions/revenuecat-store-subscription-status.reader.js";
import { SubscriptionCacheAdapter } from "./infrastructure/adapters/subscriptions/subscription-cache.adapter.js";
import { SubscriptionEventNotifierAdapter } from "./infrastructure/adapters/subscriptions/subscription-event-notifier.adapter.js";
import { SubscriptionWebhookLockAdapter } from "./infrastructure/adapters/subscriptions/subscription-webhook-lock.adapter.js";
import { TrialEndingNotifierAdapter } from "./infrastructure/adapters/subscriptions/trial-ending-notifier.adapter.js";
import { UpcomingRenewalNotifierAdapter } from "./infrastructure/adapters/subscriptions/upcoming-renewal-notifier.adapter.js";
import { WebhookSignatureGuard } from "./infrastructure/guards/subscriptions/webhook-signature.guard.js";
import { PremiumGrantSweepJob } from "./infrastructure/jobs/subscriptions/premium-grant-sweep.job.js";
import { PremiumGrantSweepProcessor } from "./infrastructure/jobs/subscriptions/premium-grant-sweep.processor.js";
import { StoreSubscriptionReconcileProcessor } from "./infrastructure/jobs/subscriptions/store-subscription-reconcile.processor.js";
import { StoreSubscriptionReconcileScheduler } from "./infrastructure/jobs/subscriptions/store-subscription-reconcile.scheduler.js";
import { DrizzlePremiumGrantEndingNoticeSource } from "./infrastructure/persistence/subscriptions/drizzle-premium-grant-ending-notice.source.js";
import { DrizzlePremiumGrantRepository } from "./infrastructure/persistence/subscriptions/drizzle-premium-grant.repository.js";
import { DrizzleSubscriptionEventReceiptRepository } from "./infrastructure/persistence/subscriptions/drizzle-subscription-event-receipt.repository.js";
import { DrizzleSubscriptionRepository } from "./infrastructure/persistence/subscriptions/drizzle-subscription.repository.js";
import { DrizzleTrialEndingNoticeSource } from "./infrastructure/persistence/subscriptions/drizzle-trial-ending-notice.source.js";
import { DrizzleUpcomingRenewalNoticeSource } from "./infrastructure/persistence/subscriptions/drizzle-upcoming-renewal-notice.source.js";
import { RevenueCatWebhookReceiver } from "./infrastructure/revenuecat/revenuecat-webhook.receiver.js";
import { RevenueCatWebhookController } from "./presentation/controllers/subscriptions/v1/revenuecat-webhook.controller.js";

@Module({
  imports: [
    IdentityUserAccessModule,
    AccessModule,
    OperationsNotificationsModule,
    NotificationDeliveryModule,
    HttpClientModule.register({
      name: REVENUECAT_HTTP_CLIENT,
      retry: false,
      throwOnHttpError: false,
      timeout: REVENUECAT_TIMEOUT_MS,
    }),
  ],
  controllers: [RevenueCatWebhookController],
  providers: [
    applyStoreSubscriptionEventProvider,
    RevenueCatWebhookReceiver,
    { provide: SUBSCRIPTION_USER_MUTATION_LOCK, useExisting: USER_MUTATION_LOCK },
    {
      provide: SUBSCRIPTION_EVENT_RECEIPT_REPOSITORY,
      useClass: DrizzleSubscriptionEventReceiptRepository,
    },
    WebhookSignatureGuard,
    {
      provide: SUBSCRIPTION_REPOSITORY,
      useClass: DrizzleSubscriptionRepository,
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
    { provide: PREMIUM_GRANT_REPOSITORY, useClass: DrizzlePremiumGrantRepository },
    { provide: PREMIUM_GRANT_NOTIFIER, useClass: PremiumGrantNotifierAdapter },
    { provide: TRIAL_ENDING_NOTIFIER, useClass: TrialEndingNotifierAdapter },
    {
      provide: PREMIUM_GRANT_ENDING_NOTICE_SOURCE,
      useClass: DrizzlePremiumGrantEndingNoticeSource,
    },
    { provide: TRIAL_ENDING_NOTICE_SOURCE, useClass: DrizzleTrialEndingNoticeSource },
    { provide: UPCOMING_RENEWAL_NOTIFIER, useClass: UpcomingRenewalNotifierAdapter },
    { provide: UPCOMING_RENEWAL_NOTICE_SOURCE, useClass: DrizzleUpcomingRenewalNoticeSource },
    // 야간 판단은 notification Context의 공개 capability다. 반환 타입으로 두 Port의 구조 호환을 확인한다
    {
      provide: QUIET_HOURS_READER,
      inject: [PUSH_QUIET_HOURS_READER],
      useFactory: (reader: PushQuietHoursReaderPort): QuietHoursReaderPort => reader,
    },
    premiumAccessProjectorProvider,
    premiumAccessReaderProvider,
    premiumGranterProvider,
    sweepPremiumGrantsProvider,
    revokePremiumGrantProvider,
    billingNoticeSweeperProvider,
    notifyEndingPremiumGrantsProvider,
    notifyEndingTrialsProvider,
    notifyUpcomingRenewalsProvider,
    { provide: PREMIUM_GRANTER, useExisting: PremiumGranter },
    { provide: PREMIUM_ACCESS_READER, useExisting: PremiumAccessReader },
    PremiumGrantSweepJob,
    PremiumGrantSweepProcessor,
    {
      provide: STORE_SUBSCRIPTION_STATUS_READER,
      useClass: RevenueCatStoreSubscriptionStatusReader,
    },
    {
      provide: STORE_SUBSCRIPTION_RECONCILE_SCHEDULER,
      useClass: StoreSubscriptionReconcileScheduler,
    },
    reconcileStoreSubscriptionsProvider,
    StoreSubscriptionReconcileProcessor,
  ],
  exports: [PREMIUM_GRANTER, PREMIUM_ACCESS_READER],
})
export class BillingSubscriptionsModule {}
