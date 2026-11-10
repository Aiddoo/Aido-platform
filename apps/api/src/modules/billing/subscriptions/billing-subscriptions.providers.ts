import type { Provider } from "@nestjs/common";

import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { BillingUserLockPort } from "../premium-grants/application/ports/billing-user-lock.port.js";
import { PremiumAccessCachePort } from "../premium-grants/application/ports/premium-access-cache.port.js";
import { ProjectPremiumAccessUseCase } from "../premium-grants/application/use-cases/project-premium-access.use-case.js";
import { SweepBillingNoticesUseCase } from "../premium-grants/application/use-cases/sweep-billing-notices.use-case.js";
import { StoreSubscriptionReconcileSchedulerPort } from "./application/ports/store-subscription-reconcile-scheduler.port.js";
import { StoreSubscriptionStatusReaderPort } from "./application/ports/store-subscription-status.reader.port.js";
import { SubscriptionEventNotifierPort } from "./application/ports/subscription-event-notifier.port.js";
import { SubscriptionEventReceiptRepositoryPort } from "./application/ports/subscription-event-receipt.repository.port.js";
import { SubscriptionUserReaderPort } from "./application/ports/subscription-user.reader.port.js";
import { SubscriptionWebhookLockPort } from "./application/ports/subscription-webhook-lock.port.js";
import { SubscriptionRepositoryPort } from "./application/ports/subscription.repository.port.js";
import { TrialEndingNoticeRepositoryPort } from "./application/ports/trial-ending-notice.repository.port.js";
import { TrialEndingNotifierPort } from "./application/ports/trial-ending-notifier.port.js";
import { UpcomingRenewalNoticeRepositoryPort } from "./application/ports/upcoming-renewal-notice.repository.port.js";
import { UpcomingRenewalNotifierPort } from "./application/ports/upcoming-renewal-notifier.port.js";
import { ApplyStoreSubscriptionEventUseCase } from "./application/use-cases/apply-store-subscription-event.use-case.js";
import { NotifyEndingTrialsUseCase } from "./application/use-cases/notify-ending-trials.use-case.js";
import { NotifyUpcomingRenewalsUseCase } from "./application/use-cases/notify-upcoming-renewals.use-case.js";
import { ReconcileStoreSubscriptionsUseCase } from "./application/use-cases/reconcile-store-subscriptions.use-case.js";
import { RevenueCatStoreSubscriptionStatusAdapter } from "./infrastructure/adapters/revenuecat/revenuecat-store-subscription-status.adapter.js";
import { RevenueCatWebhookReceiver } from "./infrastructure/adapters/revenuecat/revenuecat-webhook-receiver.adapter.js";
import { RevenueCatWebhookSignatureGuard } from "./infrastructure/adapters/revenuecat/revenuecat-webhook-signature.guard.js";
import { SubscriptionEventNotifierAdapter } from "./infrastructure/adapters/subscription-event-notifier.adapter.js";
import { SubscriptionWebhookLockAdapter } from "./infrastructure/adapters/subscription-webhook-lock.adapter.js";
import { TrialEndingNotifierAdapter } from "./infrastructure/adapters/trial-ending-notifier.adapter.js";
import { UpcomingRenewalNotifierAdapter } from "./infrastructure/adapters/upcoming-renewal-notifier.adapter.js";
import { PremiumGrantSweepProcessor } from "./infrastructure/jobs/premium-grant-sweep.processor.js";
import { PremiumGrantSweepScheduler } from "./infrastructure/jobs/premium-grant-sweep.scheduler.js";
import { StoreSubscriptionReconcileProcessor } from "./infrastructure/jobs/store-subscription-reconcile.processor.js";
import { StoreSubscriptionReconcileScheduler } from "./infrastructure/jobs/store-subscription-reconcile.scheduler.js";
import { DrizzleSubscriptionEventReceiptRepository } from "./infrastructure/persistence/drizzle-subscription-event-receipt.repository.js";
import { DrizzleSubscriptionUserReader } from "./infrastructure/persistence/drizzle-subscription-user.reader.js";
import { DrizzleSubscriptionRepository } from "./infrastructure/persistence/drizzle-subscription.repository.js";
import { DrizzleTrialEndingNoticeRepository } from "./infrastructure/persistence/drizzle-trial-ending-notice.repository.js";
import { DrizzleUpcomingRenewalNoticeRepository } from "./infrastructure/persistence/drizzle-upcoming-renewal-notice.repository.js";

export const BILLING_SUBSCRIPTIONS_PROVIDERS = [
  { provide: SubscriptionRepositoryPort, useClass: DrizzleSubscriptionRepository },
  { provide: SubscriptionUserReaderPort, useClass: DrizzleSubscriptionUserReader },
  {
    provide: SubscriptionEventReceiptRepositoryPort,
    useClass: DrizzleSubscriptionEventReceiptRepository,
  },
  { provide: SubscriptionEventNotifierPort, useClass: SubscriptionEventNotifierAdapter },
  { provide: SubscriptionWebhookLockPort, useClass: SubscriptionWebhookLockAdapter },
  {
    provide: StoreSubscriptionStatusReaderPort,
    useClass: RevenueCatStoreSubscriptionStatusAdapter,
  },
  {
    provide: StoreSubscriptionReconcileSchedulerPort,
    useClass: StoreSubscriptionReconcileScheduler,
  },
  { provide: TrialEndingNoticeRepositoryPort, useClass: DrizzleTrialEndingNoticeRepository },
  { provide: TrialEndingNotifierPort, useClass: TrialEndingNotifierAdapter },
  {
    provide: UpcomingRenewalNoticeRepositoryPort,
    useClass: DrizzleUpcomingRenewalNoticeRepository,
  },
  { provide: UpcomingRenewalNotifierPort, useClass: UpcomingRenewalNotifierAdapter },
  provideUseCase(ApplyStoreSubscriptionEventUseCase, {
    subscriptionRepository: SubscriptionRepositoryPort,
    subscriptionUserReader: SubscriptionUserReaderPort,
    receiptRepository: SubscriptionEventReceiptRepositoryPort,
    userLock: BillingUserLockPort,
    unitOfWork: UnitOfWorkPort,
    cache: PremiumAccessCachePort,
    notifier: SubscriptionEventNotifierPort,
    webhookLock: SubscriptionWebhookLockPort,
    projectPremiumAccess: ProjectPremiumAccessUseCase,
    reconcileScheduler: StoreSubscriptionReconcileSchedulerPort,
    clock: ClockPort,
    logger: loggerFor(ApplyStoreSubscriptionEventUseCase),
  }),
  provideUseCase(ReconcileStoreSubscriptionsUseCase, {
    subscriptionRepository: SubscriptionRepositoryPort,
    statusReader: StoreSubscriptionStatusReaderPort,
    userLock: BillingUserLockPort,
    unitOfWork: UnitOfWorkPort,
    projectPremiumAccess: ProjectPremiumAccessUseCase,
    cache: PremiumAccessCachePort,
  }),
  provideUseCase(NotifyEndingTrialsUseCase, {
    sweepBillingNotices: SweepBillingNoticesUseCase,
    noticeRepository: TrialEndingNoticeRepositoryPort,
    notifier: TrialEndingNotifierPort,
  }),
  provideUseCase(NotifyUpcomingRenewalsUseCase, {
    sweepBillingNotices: SweepBillingNoticesUseCase,
    noticeRepository: UpcomingRenewalNoticeRepositoryPort,
    notifier: UpcomingRenewalNotifierPort,
  }),
  RevenueCatWebhookReceiver,
  RevenueCatWebhookSignatureGuard,
  PremiumGrantSweepScheduler,
  PremiumGrantSweepProcessor,
  StoreSubscriptionReconcileProcessor,
] satisfies Provider[];
