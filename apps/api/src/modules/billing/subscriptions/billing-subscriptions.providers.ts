import type { Provider } from "@nestjs/common";

import {
  PremiumAccessCachePort,
  ProjectPremiumAccessUseCase,
} from "#api/modules/billing/premium-grants/billing-premium-grants.public";
import { UserMutationLockPort } from "#api/modules/identity/users/identity-users.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { SweepBillingNoticesUseCase } from "../shared/application/use-cases/sweep-billing-notices.use-case.js";
import { StoreCustomerConsolePort } from "./application/ports/store-customer-console.port.js";
import { StoreSubscriptionReconcileSchedulerPort } from "./application/ports/store-subscription-reconcile-scheduler.port.js";
import { StoreSubscriptionStatusReaderPort } from "./application/ports/store-subscription-status.reader.port.js";
import { StoreWebhookPort } from "./application/ports/store-webhook.port.js";
import { SubscriptionEventNotifierPort } from "./application/ports/subscription-event-notifier.port.js";
import { SubscriptionEventReceiptRepositoryPort } from "./application/ports/subscription-event-receipt.repository.port.js";
import { SubscriptionUserReaderPort } from "./application/ports/subscription-user.reader.port.js";
import { SubscriptionRepositoryPort } from "./application/ports/subscription.repository.port.js";
import { TrialEndingNoticeRepositoryPort } from "./application/ports/trial-ending-notice.repository.port.js";
import { TrialEndingNotifierPort } from "./application/ports/trial-ending-notifier.port.js";
import { UpcomingRenewalNoticeRepositoryPort } from "./application/ports/upcoming-renewal-notice.repository.port.js";
import { UpcomingRenewalNotifierPort } from "./application/ports/upcoming-renewal-notifier.port.js";
import { ApplyStoreSubscriptionEventUseCase } from "./application/use-cases/apply-store-subscription-event.use-case.js";
import { ApplySubscriptionChainEventUseCase } from "./application/use-cases/apply-subscription-chain-event.use-case.js";
import { ChangeSubscriptionChainUseCase } from "./application/use-cases/change-subscription-chain.use-case.js";
import { NotifyEndingTrialsUseCase } from "./application/use-cases/notify-ending-trials.use-case.js";
import { NotifyUpcomingRenewalsUseCase } from "./application/use-cases/notify-upcoming-renewals.use-case.js";
import { ReconcileStoreSubscriptionsUseCase } from "./application/use-cases/reconcile-store-subscriptions.use-case.js";
import { TransferSubscriptionsUseCase } from "./application/use-cases/transfer-subscriptions.use-case.js";
import { IdentitySubscriptionUserAdapter } from "./infrastructure/adapters/identity-subscription-user.adapter.js";
import { RevenueCatCustomerConsoleAdapter } from "./infrastructure/adapters/revenuecat/revenuecat-customer-console.adapter.js";
import { RevenueCatStoreSubscriptionStatusAdapter } from "./infrastructure/adapters/revenuecat/revenuecat-store-subscription-status.adapter.js";
import { RevenueCatStoreWebhookAdapter } from "./infrastructure/adapters/revenuecat/revenuecat-store-webhook.adapter.js";
import { SubscriptionEventNotifierAdapter } from "./infrastructure/adapters/subscription-event-notifier.adapter.js";
import { TrialEndingNotifierAdapter } from "./infrastructure/adapters/trial-ending-notifier.adapter.js";
import { UpcomingRenewalNotifierAdapter } from "./infrastructure/adapters/upcoming-renewal-notifier.adapter.js";
import { PremiumGrantSweepProcessor } from "./infrastructure/jobs/premium-grant-sweep.processor.js";
import { PremiumGrantSweepScheduler } from "./infrastructure/jobs/premium-grant-sweep.scheduler.js";
import { StoreSubscriptionReconcileProcessor } from "./infrastructure/jobs/store-subscription-reconcile.processor.js";
import { StoreSubscriptionReconcileScheduler } from "./infrastructure/jobs/store-subscription-reconcile.scheduler.js";
import { DrizzleSubscriptionEventReceiptRepository } from "./infrastructure/persistence/drizzle-subscription-event-receipt.repository.js";
import { DrizzleSubscriptionRepository } from "./infrastructure/persistence/drizzle-subscription.repository.js";
import { DrizzleTrialEndingNoticeRepository } from "./infrastructure/persistence/drizzle-trial-ending-notice.repository.js";
import { DrizzleUpcomingRenewalNoticeRepository } from "./infrastructure/persistence/drizzle-upcoming-renewal-notice.repository.js";
import { StoreWebhookGuard } from "./presentation/http/guards/store-webhook.guard.js";

export const BILLING_SUBSCRIPTIONS_PROVIDERS = [
  { provide: SubscriptionRepositoryPort, useClass: DrizzleSubscriptionRepository },
  { provide: SubscriptionUserReaderPort, useClass: IdentitySubscriptionUserAdapter },
  {
    provide: SubscriptionEventReceiptRepositoryPort,
    useClass: DrizzleSubscriptionEventReceiptRepository,
  },
  { provide: SubscriptionEventNotifierPort, useClass: SubscriptionEventNotifierAdapter },
  { provide: StoreCustomerConsolePort, useClass: RevenueCatCustomerConsoleAdapter },
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
  { provide: StoreWebhookPort, useClass: RevenueCatStoreWebhookAdapter },
  provideUseCase(ChangeSubscriptionChainUseCase, {
    subscriptionRepository: SubscriptionRepositoryPort,
    projectPremiumAccess: ProjectPremiumAccessUseCase,
    clock: ClockPort,
    logger: loggerFor(ChangeSubscriptionChainUseCase),
  }),
  provideUseCase(ApplySubscriptionChainEventUseCase, {
    subscriptionRepository: SubscriptionRepositoryPort,
    subscriptionUserReader: SubscriptionUserReaderPort,
    receiptRepository: SubscriptionEventReceiptRepositoryPort,
    userLock: UserMutationLockPort,
    mutationLock: MutationLockPort,
    unitOfWork: UnitOfWorkPort,
    changeSubscriptionChain: ChangeSubscriptionChainUseCase,
    notifier: SubscriptionEventNotifierPort,
    reconcileScheduler: StoreSubscriptionReconcileSchedulerPort,
    clock: ClockPort,
    logger: loggerFor(ApplySubscriptionChainEventUseCase),
  }),
  provideUseCase(TransferSubscriptionsUseCase, {
    subscriptionRepository: SubscriptionRepositoryPort,
    subscriptionUserReader: SubscriptionUserReaderPort,
    receiptRepository: SubscriptionEventReceiptRepositoryPort,
    userLock: UserMutationLockPort,
    mutationLock: MutationLockPort,
    unitOfWork: UnitOfWorkPort,
    projectPremiumAccess: ProjectPremiumAccessUseCase,
    clock: ClockPort,
  }),
  provideUseCase(ApplyStoreSubscriptionEventUseCase, {
    applySubscriptionChainEvent: ApplySubscriptionChainEventUseCase,
    transferSubscriptions: TransferSubscriptionsUseCase,
    cache: PremiumAccessCachePort,
    notifier: SubscriptionEventNotifierPort,
    logger: loggerFor(ApplyStoreSubscriptionEventUseCase),
  }),
  provideUseCase(ReconcileStoreSubscriptionsUseCase, {
    subscriptionRepository: SubscriptionRepositoryPort,
    statusReader: StoreSubscriptionStatusReaderPort,
    userLock: UserMutationLockPort,
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
  StoreWebhookGuard,
  PremiumGrantSweepScheduler,
  PremiumGrantSweepProcessor,
  StoreSubscriptionReconcileProcessor,
] satisfies Provider[];
