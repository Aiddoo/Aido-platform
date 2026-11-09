import { Logger, type FactoryProvider } from "@nestjs/common";

import { AFTER_COMMIT_TASK_REGISTRY, UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { PREMIUM_GRANT_ENDING_NOTICE_SOURCE } from "./application/ports/subscriptions/premium-grant-ending-notice.source.port.js";
import { PREMIUM_GRANT_NOTIFIER } from "./application/ports/subscriptions/premium-grant-notifier.port.js";
import { PREMIUM_GRANT_REPOSITORY } from "./application/ports/subscriptions/premium-grant.repository.port.js";
import { QUIET_HOURS_READER } from "./application/ports/subscriptions/quiet-hours.reader.port.js";
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
import { BillingNoticeSweeper } from "./application/services/subscriptions/billing-notice-sweeper.js";
import { PremiumAccessProjector } from "./application/services/subscriptions/premium-access-projector.service.js";
import { PremiumAccessReader } from "./application/services/subscriptions/premium-access-reader.service.js";
import { PremiumGranter } from "./application/services/subscriptions/premium-granter.service.js";
import { HandleWebhookEvent } from "./application/use-cases/subscriptions/handle-webhook-event.use-case.js";
import { NotifyEndingPremiumGrants } from "./application/use-cases/subscriptions/notify-ending-premium-grants.use-case.js";
import { NotifyEndingTrials } from "./application/use-cases/subscriptions/notify-ending-trials.use-case.js";
import { NotifyUpcomingRenewals } from "./application/use-cases/subscriptions/notify-upcoming-renewals.use-case.js";
import { RevokePremiumGrant } from "./application/use-cases/subscriptions/revoke-premium-grant.use-case.js";
import { SweepPremiumGrants } from "./application/use-cases/subscriptions/sweep-premium-grants.use-case.js";

export const premiumAccessProjectorProvider: FactoryProvider<PremiumAccessProjector> = {
  provide: PremiumAccessProjector,
  inject: [SUBSCRIPTION_REPOSITORY, PREMIUM_GRANT_REPOSITORY],
  useFactory: (
    subscriptionRepository: ConstructorParameters<
      typeof PremiumAccessProjector
    >[0]["subscriptionRepository"],
    premiumGrantRepository: ConstructorParameters<
      typeof PremiumAccessProjector
    >[0]["premiumGrantRepository"],
  ) => new PremiumAccessProjector({ subscriptionRepository, premiumGrantRepository }),
};

export const premiumAccessReaderProvider: FactoryProvider<PremiumAccessReader> = {
  provide: PremiumAccessReader,
  inject: [PremiumAccessProjector, PREMIUM_GRANT_REPOSITORY],
  useFactory: (
    premiumAccessProjector: ConstructorParameters<
      typeof PremiumAccessReader
    >[0]["premiumAccessProjector"],
    premiumGrantRepository: ConstructorParameters<
      typeof PremiumAccessReader
    >[0]["premiumGrantRepository"],
  ) => new PremiumAccessReader({ premiumAccessProjector, premiumGrantRepository }),
};

export const premiumGranterProvider: FactoryProvider<PremiumGranter> = {
  provide: PremiumGranter,
  inject: [
    PREMIUM_GRANT_REPOSITORY,
    PremiumAccessProjector,
    SUBSCRIPTION_USER_MUTATION_LOCK,
    UNIT_OF_WORK,
    AFTER_COMMIT_TASK_REGISTRY,
    SUBSCRIPTION_CACHE,
  ],
  useFactory: (
    premiumGrantRepository: ConstructorParameters<
      typeof PremiumGranter
    >[0]["premiumGrantRepository"],
    premiumAccessProjector: ConstructorParameters<
      typeof PremiumGranter
    >[0]["premiumAccessProjector"],
    userMutationLock: ConstructorParameters<typeof PremiumGranter>[0]["userMutationLock"],
    unitOfWork: ConstructorParameters<typeof PremiumGranter>[0]["unitOfWork"],
    afterCommitTasks: ConstructorParameters<typeof PremiumGranter>[0]["afterCommitTasks"],
    cache: ConstructorParameters<typeof PremiumGranter>[0]["cache"],
  ) =>
    new PremiumGranter({
      premiumGrantRepository,
      premiumAccessProjector,
      userMutationLock,
      unitOfWork,
      afterCommitTasks,
      cache,
      logger: new Logger(PremiumGranter.name),
    }),
};

export const sweepPremiumGrantsProvider: FactoryProvider<SweepPremiumGrants> = {
  provide: SweepPremiumGrants,
  inject: [
    PREMIUM_GRANT_REPOSITORY,
    SUBSCRIPTION_REPOSITORY,
    PremiumAccessProjector,
    SUBSCRIPTION_USER_MUTATION_LOCK,
    UNIT_OF_WORK,
    SUBSCRIPTION_CACHE,
  ],
  useFactory: (
    premiumGrantRepository: ConstructorParameters<
      typeof SweepPremiumGrants
    >[0]["premiumGrantRepository"],
    subscriptionRepository: ConstructorParameters<
      typeof SweepPremiumGrants
    >[0]["subscriptionRepository"],
    premiumAccessProjector: ConstructorParameters<
      typeof SweepPremiumGrants
    >[0]["premiumAccessProjector"],
    userMutationLock: ConstructorParameters<typeof SweepPremiumGrants>[0]["userMutationLock"],
    unitOfWork: ConstructorParameters<typeof SweepPremiumGrants>[0]["unitOfWork"],
    cache: ConstructorParameters<typeof SweepPremiumGrants>[0]["cache"],
  ) =>
    new SweepPremiumGrants({
      premiumGrantRepository,
      subscriptionRepository,
      premiumAccessProjector,
      userMutationLock,
      unitOfWork,
      cache,
      logger: new Logger(SweepPremiumGrants.name),
    }),
};

export const revokePremiumGrantProvider: FactoryProvider<RevokePremiumGrant> = {
  provide: RevokePremiumGrant,
  inject: [
    PREMIUM_GRANT_REPOSITORY,
    PremiumAccessProjector,
    SUBSCRIPTION_USER_MUTATION_LOCK,
    UNIT_OF_WORK,
    SUBSCRIPTION_CACHE,
  ],
  useFactory: (
    premiumGrantRepository: ConstructorParameters<
      typeof RevokePremiumGrant
    >[0]["premiumGrantRepository"],
    premiumAccessProjector: ConstructorParameters<
      typeof RevokePremiumGrant
    >[0]["premiumAccessProjector"],
    userMutationLock: ConstructorParameters<typeof RevokePremiumGrant>[0]["userMutationLock"],
    unitOfWork: ConstructorParameters<typeof RevokePremiumGrant>[0]["unitOfWork"],
    cache: ConstructorParameters<typeof RevokePremiumGrant>[0]["cache"],
  ) =>
    new RevokePremiumGrant({
      premiumGrantRepository,
      premiumAccessProjector,
      userMutationLock,
      unitOfWork,
      cache,
      logger: new Logger(RevokePremiumGrant.name),
    }),
};

export const billingNoticeSweeperProvider: FactoryProvider<BillingNoticeSweeper> = {
  provide: BillingNoticeSweeper,
  inject: [QUIET_HOURS_READER, UNIT_OF_WORK],
  useFactory: (
    quietHoursReader: ConstructorParameters<typeof BillingNoticeSweeper>[0]["quietHoursReader"],
    unitOfWork: ConstructorParameters<typeof BillingNoticeSweeper>[0]["unitOfWork"],
  ) =>
    new BillingNoticeSweeper({
      quietHoursReader,
      unitOfWork,
      logger: new Logger(BillingNoticeSweeper.name),
    }),
};

export const notifyEndingPremiumGrantsProvider: FactoryProvider<NotifyEndingPremiumGrants> = {
  provide: NotifyEndingPremiumGrants,
  inject: [BillingNoticeSweeper, PREMIUM_GRANT_ENDING_NOTICE_SOURCE, PREMIUM_GRANT_NOTIFIER],
  useFactory: (
    sweeper: ConstructorParameters<typeof NotifyEndingPremiumGrants>[0]["sweeper"],
    source: ConstructorParameters<typeof NotifyEndingPremiumGrants>[0]["source"],
    notifier: ConstructorParameters<typeof NotifyEndingPremiumGrants>[0]["notifier"],
  ) => new NotifyEndingPremiumGrants({ sweeper, source, notifier }),
};

export const notifyEndingTrialsProvider: FactoryProvider<NotifyEndingTrials> = {
  provide: NotifyEndingTrials,
  inject: [BillingNoticeSweeper, TRIAL_ENDING_NOTICE_SOURCE, TRIAL_ENDING_NOTIFIER],
  useFactory: (
    sweeper: ConstructorParameters<typeof NotifyEndingTrials>[0]["sweeper"],
    source: ConstructorParameters<typeof NotifyEndingTrials>[0]["source"],
    notifier: ConstructorParameters<typeof NotifyEndingTrials>[0]["notifier"],
  ) => new NotifyEndingTrials({ sweeper, source, notifier }),
};

export const notifyUpcomingRenewalsProvider: FactoryProvider<NotifyUpcomingRenewals> = {
  provide: NotifyUpcomingRenewals,
  inject: [BillingNoticeSweeper, UPCOMING_RENEWAL_NOTICE_SOURCE, UPCOMING_RENEWAL_NOTIFIER],
  useFactory: (
    sweeper: ConstructorParameters<typeof NotifyUpcomingRenewals>[0]["sweeper"],
    source: ConstructorParameters<typeof NotifyUpcomingRenewals>[0]["source"],
    notifier: ConstructorParameters<typeof NotifyUpcomingRenewals>[0]["notifier"],
  ) => new NotifyUpcomingRenewals({ sweeper, source, notifier }),
};

export const handleWebhookEventProvider: FactoryProvider<HandleWebhookEvent> = {
  provide: HandleWebhookEvent,
  inject: [
    SUBSCRIPTION_REPOSITORY,
    SUBSCRIPTION_EVENT_RECEIPT_REPOSITORY,
    SUBSCRIPTION_USER_MUTATION_LOCK,
    UNIT_OF_WORK,
    SUBSCRIPTION_CACHE,
    SUBSCRIPTION_EVENT_NOTIFIER,
    SUBSCRIPTION_WEBHOOK_LOCK,
    PremiumAccessProjector,
  ],
  useFactory: (
    subscriptionRepository: ConstructorParameters<
      typeof HandleWebhookEvent
    >[0]["subscriptionRepository"],
    receiptRepository: ConstructorParameters<typeof HandleWebhookEvent>[0]["receiptRepository"],
    userMutationLock: ConstructorParameters<typeof HandleWebhookEvent>[0]["userMutationLock"],
    unitOfWork: ConstructorParameters<typeof HandleWebhookEvent>[0]["unitOfWork"],
    cache: ConstructorParameters<typeof HandleWebhookEvent>[0]["cache"],
    notifier: ConstructorParameters<typeof HandleWebhookEvent>[0]["notifier"],
    webhookLock: ConstructorParameters<typeof HandleWebhookEvent>[0]["webhookLock"],
    premiumAccessProjector: ConstructorParameters<
      typeof HandleWebhookEvent
    >[0]["premiumAccessProjector"],
  ) =>
    new HandleWebhookEvent({
      subscriptionRepository,
      receiptRepository,
      userMutationLock,
      unitOfWork,
      cache,
      notifier,
      webhookLock,
      premiumAccessProjector,
      logger: new Logger(HandleWebhookEvent.name),
    }),
};
