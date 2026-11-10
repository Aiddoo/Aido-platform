import { Logger, type FactoryProvider } from "@nestjs/common";

import { AFTER_COMMIT_TASK_REGISTRY, UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { SUBSCRIPTION_USER_MUTATION_LOCK } from "../premium-grants/application/ports/billing-user-lock.port.js";
import { SUBSCRIPTION_CACHE } from "../premium-grants/application/ports/premium-access-cache.port.js";
import { PREMIUM_GRANT_ENDING_NOTICE_SOURCE } from "../premium-grants/application/ports/premium-grant-ending-notice.repository.port.js";
import { PREMIUM_GRANT_NOTIFIER } from "../premium-grants/application/ports/premium-grant-notifier.port.js";
import { PREMIUM_GRANT_REPOSITORY } from "../premium-grants/application/ports/premium-grant.repository.port.js";
import { QUIET_HOURS_READER } from "../premium-grants/application/ports/quiet-hours.reader.port.js";
import { GetPremiumAccessUseCase } from "../premium-grants/application/use-cases/get-premium-access.use-case.js";
import { GrantPremiumUseCase } from "../premium-grants/application/use-cases/grant-premium.use-case.js";
import { NotifyEndingPremiumGrantsUseCase } from "../premium-grants/application/use-cases/notify-ending-premium-grants.use-case.js";
import { ProjectPremiumAccessUseCase } from "../premium-grants/application/use-cases/project-premium-access.use-case.js";
import { RevokePremiumGrantUseCase } from "../premium-grants/application/use-cases/revoke-premium-grant.use-case.js";
import { SweepBillingNoticesUseCase } from "../premium-grants/application/use-cases/sweep-billing-notices.use-case.js";
import { SweepPremiumGrantsUseCase } from "../premium-grants/application/use-cases/sweep-premium-grants.use-case.js";
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
import { ApplyStoreSubscriptionEventUseCase } from "./application/use-cases/apply-store-subscription-event.use-case.js";
import { NotifyEndingTrialsUseCase } from "./application/use-cases/notify-ending-trials.use-case.js";
import { NotifyUpcomingRenewalsUseCase } from "./application/use-cases/notify-upcoming-renewals.use-case.js";
import { ReconcileStoreSubscriptionsUseCase } from "./application/use-cases/reconcile-store-subscriptions.use-case.js";

export const premiumAccessProjectorProvider: FactoryProvider<ProjectPremiumAccessUseCase> = {
  provide: ProjectPremiumAccessUseCase,
  inject: [SUBSCRIPTION_REPOSITORY, PREMIUM_GRANT_REPOSITORY],
  useFactory: (
    subscriptionRepository: ConstructorParameters<
      typeof ProjectPremiumAccessUseCase
    >[0]["subscriptionRepository"],
    premiumGrantRepository: ConstructorParameters<
      typeof ProjectPremiumAccessUseCase
    >[0]["premiumGrantRepository"],
  ) => new ProjectPremiumAccessUseCase({ subscriptionRepository, premiumGrantRepository }),
};

export const premiumAccessReaderProvider: FactoryProvider<GetPremiumAccessUseCase> = {
  provide: GetPremiumAccessUseCase,
  inject: [ProjectPremiumAccessUseCase, PREMIUM_GRANT_REPOSITORY],
  useFactory: (
    premiumAccessProjector: ConstructorParameters<
      typeof GetPremiumAccessUseCase
    >[0]["premiumAccessProjector"],
    premiumGrantRepository: ConstructorParameters<
      typeof GetPremiumAccessUseCase
    >[0]["premiumGrantRepository"],
  ) => new GetPremiumAccessUseCase({ premiumAccessProjector, premiumGrantRepository }),
};

export const premiumGranterProvider: FactoryProvider<GrantPremiumUseCase> = {
  provide: GrantPremiumUseCase,
  inject: [
    PREMIUM_GRANT_REPOSITORY,
    ProjectPremiumAccessUseCase,
    SUBSCRIPTION_USER_MUTATION_LOCK,
    UNIT_OF_WORK,
    AFTER_COMMIT_TASK_REGISTRY,
    SUBSCRIPTION_CACHE,
  ],
  useFactory: (
    premiumGrantRepository: ConstructorParameters<
      typeof GrantPremiumUseCase
    >[0]["premiumGrantRepository"],
    premiumAccessProjector: ConstructorParameters<
      typeof GrantPremiumUseCase
    >[0]["premiumAccessProjector"],
    userMutationLock: ConstructorParameters<typeof GrantPremiumUseCase>[0]["userMutationLock"],
    unitOfWork: ConstructorParameters<typeof GrantPremiumUseCase>[0]["unitOfWork"],
    afterCommitTasks: ConstructorParameters<typeof GrantPremiumUseCase>[0]["afterCommitTasks"],
    cache: ConstructorParameters<typeof GrantPremiumUseCase>[0]["cache"],
  ) =>
    new GrantPremiumUseCase({
      premiumGrantRepository,
      premiumAccessProjector,
      userMutationLock,
      unitOfWork,
      afterCommitTasks,
      cache,
      logger: new Logger(GrantPremiumUseCase.name),
    }),
};

export const sweepPremiumGrantsProvider: FactoryProvider<SweepPremiumGrantsUseCase> = {
  provide: SweepPremiumGrantsUseCase,
  inject: [
    PREMIUM_GRANT_REPOSITORY,
    SUBSCRIPTION_REPOSITORY,
    ProjectPremiumAccessUseCase,
    SUBSCRIPTION_USER_MUTATION_LOCK,
    UNIT_OF_WORK,
    SUBSCRIPTION_CACHE,
  ],
  useFactory: (
    premiumGrantRepository: ConstructorParameters<
      typeof SweepPremiumGrantsUseCase
    >[0]["premiumGrantRepository"],
    subscriptionRepository: ConstructorParameters<
      typeof SweepPremiumGrantsUseCase
    >[0]["subscriptionRepository"],
    premiumAccessProjector: ConstructorParameters<
      typeof SweepPremiumGrantsUseCase
    >[0]["premiumAccessProjector"],
    userMutationLock: ConstructorParameters<
      typeof SweepPremiumGrantsUseCase
    >[0]["userMutationLock"],
    unitOfWork: ConstructorParameters<typeof SweepPremiumGrantsUseCase>[0]["unitOfWork"],
    cache: ConstructorParameters<typeof SweepPremiumGrantsUseCase>[0]["cache"],
  ) =>
    new SweepPremiumGrantsUseCase({
      premiumGrantRepository,
      subscriptionRepository,
      premiumAccessProjector,
      userMutationLock,
      unitOfWork,
      cache,
      logger: new Logger(SweepPremiumGrantsUseCase.name),
    }),
};

export const revokePremiumGrantProvider: FactoryProvider<RevokePremiumGrantUseCase> = {
  provide: RevokePremiumGrantUseCase,
  inject: [
    PREMIUM_GRANT_REPOSITORY,
    ProjectPremiumAccessUseCase,
    SUBSCRIPTION_USER_MUTATION_LOCK,
    UNIT_OF_WORK,
    SUBSCRIPTION_CACHE,
  ],
  useFactory: (
    premiumGrantRepository: ConstructorParameters<
      typeof RevokePremiumGrantUseCase
    >[0]["premiumGrantRepository"],
    premiumAccessProjector: ConstructorParameters<
      typeof RevokePremiumGrantUseCase
    >[0]["premiumAccessProjector"],
    userMutationLock: ConstructorParameters<
      typeof RevokePremiumGrantUseCase
    >[0]["userMutationLock"],
    unitOfWork: ConstructorParameters<typeof RevokePremiumGrantUseCase>[0]["unitOfWork"],
    cache: ConstructorParameters<typeof RevokePremiumGrantUseCase>[0]["cache"],
  ) =>
    new RevokePremiumGrantUseCase({
      premiumGrantRepository,
      premiumAccessProjector,
      userMutationLock,
      unitOfWork,
      cache,
      logger: new Logger(RevokePremiumGrantUseCase.name),
    }),
};

export const billingNoticeSweeperProvider: FactoryProvider<SweepBillingNoticesUseCase> = {
  provide: SweepBillingNoticesUseCase,
  inject: [QUIET_HOURS_READER, UNIT_OF_WORK],
  useFactory: (
    quietHoursReader: ConstructorParameters<
      typeof SweepBillingNoticesUseCase
    >[0]["quietHoursReader"],
    unitOfWork: ConstructorParameters<typeof SweepBillingNoticesUseCase>[0]["unitOfWork"],
  ) =>
    new SweepBillingNoticesUseCase({
      quietHoursReader,
      unitOfWork,
      logger: new Logger(SweepBillingNoticesUseCase.name),
    }),
};

export const notifyEndingPremiumGrantsProvider: FactoryProvider<NotifyEndingPremiumGrantsUseCase> =
  {
    provide: NotifyEndingPremiumGrantsUseCase,
    inject: [
      SweepBillingNoticesUseCase,
      PREMIUM_GRANT_ENDING_NOTICE_SOURCE,
      PREMIUM_GRANT_NOTIFIER,
    ],
    useFactory: (
      sweeper: ConstructorParameters<typeof NotifyEndingPremiumGrantsUseCase>[0]["sweeper"],
      source: ConstructorParameters<typeof NotifyEndingPremiumGrantsUseCase>[0]["source"],
      notifier: ConstructorParameters<typeof NotifyEndingPremiumGrantsUseCase>[0]["notifier"],
    ) => new NotifyEndingPremiumGrantsUseCase({ sweeper, source, notifier }),
  };

export const notifyEndingTrialsProvider: FactoryProvider<NotifyEndingTrialsUseCase> = {
  provide: NotifyEndingTrialsUseCase,
  inject: [SweepBillingNoticesUseCase, TRIAL_ENDING_NOTICE_SOURCE, TRIAL_ENDING_NOTIFIER],
  useFactory: (
    sweeper: ConstructorParameters<typeof NotifyEndingTrialsUseCase>[0]["sweeper"],
    source: ConstructorParameters<typeof NotifyEndingTrialsUseCase>[0]["source"],
    notifier: ConstructorParameters<typeof NotifyEndingTrialsUseCase>[0]["notifier"],
  ) => new NotifyEndingTrialsUseCase({ sweeper, source, notifier }),
};

export const notifyUpcomingRenewalsProvider: FactoryProvider<NotifyUpcomingRenewalsUseCase> = {
  provide: NotifyUpcomingRenewalsUseCase,
  inject: [SweepBillingNoticesUseCase, UPCOMING_RENEWAL_NOTICE_SOURCE, UPCOMING_RENEWAL_NOTIFIER],
  useFactory: (
    sweeper: ConstructorParameters<typeof NotifyUpcomingRenewalsUseCase>[0]["sweeper"],
    source: ConstructorParameters<typeof NotifyUpcomingRenewalsUseCase>[0]["source"],
    notifier: ConstructorParameters<typeof NotifyUpcomingRenewalsUseCase>[0]["notifier"],
  ) => new NotifyUpcomingRenewalsUseCase({ sweeper, source, notifier }),
};

export const applyStoreSubscriptionEventProvider: FactoryProvider<ApplyStoreSubscriptionEventUseCase> =
  {
    provide: ApplyStoreSubscriptionEventUseCase,
    inject: [
      SUBSCRIPTION_REPOSITORY,
      SUBSCRIPTION_EVENT_RECEIPT_REPOSITORY,
      SUBSCRIPTION_USER_MUTATION_LOCK,
      UNIT_OF_WORK,
      SUBSCRIPTION_CACHE,
      SUBSCRIPTION_EVENT_NOTIFIER,
      SUBSCRIPTION_WEBHOOK_LOCK,
      ProjectPremiumAccessUseCase,
      STORE_SUBSCRIPTION_RECONCILE_SCHEDULER,
    ],
    useFactory: (
      subscriptionRepository: ConstructorParameters<
        typeof ApplyStoreSubscriptionEventUseCase
      >[0]["subscriptionRepository"],
      receiptRepository: ConstructorParameters<
        typeof ApplyStoreSubscriptionEventUseCase
      >[0]["receiptRepository"],
      userMutationLock: ConstructorParameters<
        typeof ApplyStoreSubscriptionEventUseCase
      >[0]["userMutationLock"],
      unitOfWork: ConstructorParameters<typeof ApplyStoreSubscriptionEventUseCase>[0]["unitOfWork"],
      cache: ConstructorParameters<typeof ApplyStoreSubscriptionEventUseCase>[0]["cache"],
      notifier: ConstructorParameters<typeof ApplyStoreSubscriptionEventUseCase>[0]["notifier"],
      webhookLock: ConstructorParameters<
        typeof ApplyStoreSubscriptionEventUseCase
      >[0]["webhookLock"],
      premiumAccessProjector: ConstructorParameters<
        typeof ApplyStoreSubscriptionEventUseCase
      >[0]["premiumAccessProjector"],
      reconcileScheduler: ConstructorParameters<
        typeof ApplyStoreSubscriptionEventUseCase
      >[0]["reconcileScheduler"],
    ) =>
      new ApplyStoreSubscriptionEventUseCase({
        subscriptionRepository,
        receiptRepository,
        userMutationLock,
        unitOfWork,
        cache,
        notifier,
        webhookLock,
        premiumAccessProjector,
        reconcileScheduler,
        logger: new Logger(ApplyStoreSubscriptionEventUseCase.name),
      }),
  };

export const reconcileStoreSubscriptionsProvider: FactoryProvider<ReconcileStoreSubscriptionsUseCase> =
  {
    provide: ReconcileStoreSubscriptionsUseCase,
    inject: [
      SUBSCRIPTION_REPOSITORY,
      STORE_SUBSCRIPTION_STATUS_READER,
      SUBSCRIPTION_USER_MUTATION_LOCK,
      UNIT_OF_WORK,
      ProjectPremiumAccessUseCase,
      SUBSCRIPTION_CACHE,
    ],
    useFactory: (
      subscriptionRepository: ConstructorParameters<
        typeof ReconcileStoreSubscriptionsUseCase
      >[0]["subscriptionRepository"],
      statusReader: ConstructorParameters<
        typeof ReconcileStoreSubscriptionsUseCase
      >[0]["statusReader"],
      userMutationLock: ConstructorParameters<
        typeof ReconcileStoreSubscriptionsUseCase
      >[0]["userMutationLock"],
      unitOfWork: ConstructorParameters<typeof ReconcileStoreSubscriptionsUseCase>[0]["unitOfWork"],
      premiumAccessProjector: ConstructorParameters<
        typeof ReconcileStoreSubscriptionsUseCase
      >[0]["premiumAccessProjector"],
      cache: ConstructorParameters<typeof ReconcileStoreSubscriptionsUseCase>[0]["cache"],
    ) =>
      new ReconcileStoreSubscriptionsUseCase({
        subscriptionRepository,
        statusReader,
        userMutationLock,
        unitOfWork,
        premiumAccessProjector,
        cache,
      }),
  };
