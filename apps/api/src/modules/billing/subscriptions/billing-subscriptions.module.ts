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

import { SUBSCRIPTION_USER_MUTATION_LOCK } from "../premium-grants/application/ports/billing-user-lock.port.js";
import { SUBSCRIPTION_CACHE } from "../premium-grants/application/ports/premium-access-cache.port.js";
import { PREMIUM_ACCESS_READER } from "../premium-grants/application/ports/premium-access.reader.port.js";
import { PREMIUM_GRANT_ENDING_NOTICE_SOURCE } from "../premium-grants/application/ports/premium-grant-ending-notice.repository.port.js";
import { PREMIUM_GRANT_NOTIFIER } from "../premium-grants/application/ports/premium-grant-notifier.port.js";
import { PREMIUM_GRANT_REPOSITORY } from "../premium-grants/application/ports/premium-grant.repository.port.js";
import { PREMIUM_GRANTER } from "../premium-grants/application/ports/premium-granter.port.js";
import {
  QUIET_HOURS_READER,
  type QuietHoursReaderPort,
} from "../premium-grants/application/ports/quiet-hours.reader.port.js";
import { GetPremiumAccessUseCase } from "../premium-grants/application/use-cases/get-premium-access.use-case.js";
import { GrantPremiumUseCase } from "../premium-grants/application/use-cases/grant-premium.use-case.js";
import { SubscriptionCacheAdapter } from "../premium-grants/infrastructure/adapters/premium-access-cache.adapter.js";
import { PremiumGrantNotifierAdapter } from "../premium-grants/infrastructure/adapters/premium-grant-notifier.adapter.js";
import { DrizzlePremiumGrantEndingNoticeSource } from "../premium-grants/infrastructure/persistence/drizzle-premium-grant-ending-notice.repository.js";
import { DrizzlePremiumGrantRepository } from "../premium-grants/infrastructure/persistence/drizzle-premium-grant.repository.js";
import { STORE_SUBSCRIPTION_RECONCILE_SCHEDULER } from "./application/ports/store-subscription-reconcile-scheduler.port.js";
import { STORE_SUBSCRIPTION_STATUS_READER } from "./application/ports/store-subscription-status.reader.port.js";
import { SUBSCRIPTION_EVENT_NOTIFIER } from "./application/ports/subscription-event-notifier.port.js";
import { SUBSCRIPTION_EVENT_RECEIPT_REPOSITORY } from "./application/ports/subscription-event-receipt.repository.port.js";
import { SUBSCRIPTION_WEBHOOK_LOCK } from "./application/ports/subscription-webhook-lock.port.js";
import { SUBSCRIPTION_REPOSITORY } from "./application/ports/subscription.repository.port.js";
import { TRIAL_ENDING_NOTICE_SOURCE } from "./application/ports/trial-ending-notice.repository.port.js";
import { TRIAL_ENDING_NOTIFIER } from "./application/ports/trial-ending-notifier.port.js";
import { UPCOMING_RENEWAL_NOTICE_SOURCE } from "./application/ports/upcoming-renewal-notice.repository.port.js";
import { UPCOMING_RENEWAL_NOTIFIER } from "./application/ports/upcoming-renewal-notifier.port.js";
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
} from "./billing-subscriptions.providers.js";
import {
  REVENUECAT_HTTP_CLIENT,
  REVENUECAT_TIMEOUT_MS,
  RevenueCatStoreSubscriptionStatusReader,
} from "./infrastructure/adapters/revenuecat/revenuecat-store-subscription-status.adapter.js";
import { RevenueCatWebhookReceiver } from "./infrastructure/adapters/revenuecat/revenuecat-webhook-receiver.adapter.js";
import { RevenueCatWebhookSignatureGuard } from "./infrastructure/adapters/revenuecat/revenuecat-webhook-signature.guard.js";
import { SubscriptionEventNotifierAdapter } from "./infrastructure/adapters/subscription-event-notifier.adapter.js";
import { SubscriptionWebhookLockAdapter } from "./infrastructure/adapters/subscription-webhook-lock.adapter.js";
import { TrialEndingNotifierAdapter } from "./infrastructure/adapters/trial-ending-notifier.adapter.js";
import { UpcomingRenewalNotifierAdapter } from "./infrastructure/adapters/upcoming-renewal-notifier.adapter.js";
import { PremiumGrantSweepProcessor } from "./infrastructure/jobs/premium-grant-sweep.processor.js";
import { PremiumGrantSweepJob } from "./infrastructure/jobs/premium-grant-sweep.scheduler.js";
import { StoreSubscriptionReconcileProcessor } from "./infrastructure/jobs/store-subscription-reconcile.processor.js";
import { StoreSubscriptionReconcileScheduler } from "./infrastructure/jobs/store-subscription-reconcile.scheduler.js";
import { DrizzleSubscriptionEventReceiptRepository } from "./infrastructure/persistence/drizzle-subscription-event-receipt.repository.js";
import { DrizzleSubscriptionRepository } from "./infrastructure/persistence/drizzle-subscription.repository.js";
import { DrizzleTrialEndingNoticeSource } from "./infrastructure/persistence/drizzle-trial-ending-notice.repository.js";
import { DrizzleUpcomingRenewalNoticeSource } from "./infrastructure/persistence/drizzle-upcoming-renewal-notice.repository.js";
import { RevenueCatWebhookController } from "./presentation/http/v1/revenuecat-webhook.controller.js";

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
    RevenueCatWebhookSignatureGuard,
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
    { provide: PREMIUM_GRANTER, useExisting: GrantPremiumUseCase },
    { provide: PREMIUM_ACCESS_READER, useExisting: GetPremiumAccessUseCase },
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
