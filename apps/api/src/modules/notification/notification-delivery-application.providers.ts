import { Logger, type FactoryProvider } from "@nestjs/common";

import { PaginationService } from "#api/shared/application/pagination/index";
import { AFTER_COMMIT_TASK_REGISTRY, UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { ACTIVE_PUSH_TOKEN_READER } from "./application/ports/delivery/active-push-token.reader.port.js";
import { MARKETING_PUSH_OPT_OUT_TOKEN } from "./application/ports/delivery/marketing-push-opt-out-token.port.js";
import { NOTIFICATION_CACHE } from "./application/ports/delivery/notification-cache.port.js";
import {
  NOTIFICATION_DEDUP,
  NOTIFICATION_DEDUP_LOCK,
} from "./application/ports/delivery/notification-dedup.port.js";
import { NOTIFICATION_HISTORY_READER } from "./application/ports/delivery/notification-history.reader.port.js";
import { NOTIFICATION_INBOX_READER } from "./application/ports/delivery/notification-inbox.reader.port.js";
import { NOTIFICATION_RECIPIENT_LOCALE_READER } from "./application/ports/delivery/notification-recipient-locale.reader.port.js";
import { NOTIFICATION_RECIPIENT_PREFERENCE_READER } from "./application/ports/delivery/notification-recipient-preference.reader.port.js";
import { NOTIFICATION_REPOSITORY } from "./application/ports/delivery/notification.repository.port.js";
import { PUSH_DELIVERY_JOB_ENQUEUER } from "./application/ports/delivery/push-delivery-job-enqueuer.port.js";
import { PUSH_DELIVERY_LIFECYCLE_REPOSITORY } from "./application/ports/delivery/push-delivery-lifecycle.repository.port.js";
import { PUSH_DELIVERY_OUTBOX_REPOSITORY } from "./application/ports/delivery/push-delivery-outbox.repository.port.js";
import { PUSH_DISPATCH_STAGING } from "./application/ports/delivery/push-dispatch-staging.repository.port.js";
import { PUSH_PROVIDER } from "./application/ports/delivery/push-provider.port.js";
import { PUSH_RATE_LIMITER } from "./application/ports/delivery/push-rate-limiter.port.js";
import { PUSH_RECEIPT_REPOSITORY } from "./application/ports/delivery/push-receipt.repository.port.js";
import { PUSH_TOKEN_REPOSITORY } from "./application/ports/delivery/push-token.repository.port.js";
import { USER_NOTIFICATION_SETTINGS } from "./application/ports/delivery/user-notification-settings.port.js";
import { NotificationPublisher } from "./application/publishers/delivery/notification.publisher.js";
import { NotificationHistoryReader } from "./application/readers/delivery/notification-history.reader.js";
import { NotificationAccountCleanup } from "./application/services/delivery/notification-account-cleanup.js";
import { PushDeliveryAfterCommitPublisher } from "./application/services/delivery/push-delivery-after-commit.publisher.js";
import { PushDeliveryEligibilityService } from "./application/services/delivery/push-delivery-eligibility.service.js";
import { PushNotificationDeliveryService } from "./application/services/delivery/push-notification-delivery.service.js";
import { PushNotificationPayloadFactory } from "./application/services/delivery/push-notification-payload.factory.js";
import { DeliverPushNotifications } from "./application/use-cases/delivery/deliver-push-notifications.use-case.js";
import { FinalizeBatchNotification } from "./application/use-cases/delivery/finalize-batch-notification.use-case.js";
import { GetNotifications } from "./application/use-cases/delivery/get-notifications.use-case.js";
import { GetUnreadCount } from "./application/use-cases/delivery/get-unread-count.use-case.js";
import { MarkAllAsRead } from "./application/use-cases/delivery/mark-all-as-read.use-case.js";
import { MarkAsRead } from "./application/use-cases/delivery/mark-as-read.use-case.js";
import { MarkNotificationOpened } from "./application/use-cases/delivery/mark-notification-opened.use-case.js";
import { OptOutMarketingPush } from "./application/use-cases/delivery/opt-out-marketing-push.use-case.js";
import { PersistBatchNotification } from "./application/use-cases/delivery/persist-batch-notification.use-case.js";
import { PublishPushDeliveryOutbox } from "./application/use-cases/delivery/publish-push-delivery-outbox.use-case.js";
import { ReconcilePushReceipts } from "./application/use-cases/delivery/reconcile-push-receipts.use-case.js";
import { RecoverFailedPushDeliveries } from "./application/use-cases/delivery/recover-failed-push-deliveries.use-case.js";
import { RegisterPushToken } from "./application/use-cases/delivery/register-push-token.use-case.js";
import { RelayPushDeliveryOutbox } from "./application/use-cases/delivery/relay-push-delivery-outbox.use-case.js";
import { SendBatchNotification } from "./application/use-cases/delivery/send-batch-notification.use-case.js";
import { SendBillingIssueNotification } from "./application/use-cases/delivery/send-billing-issue-notification.use-case.js";
import { SendCheerNotification } from "./application/use-cases/delivery/send-cheer-notification.use-case.js";
import { SendFollowAcceptedNotification } from "./application/use-cases/delivery/send-follow-accepted-notification.use-case.js";
import { SendFollowRequestNotification } from "./application/use-cases/delivery/send-follow-request-notification.use-case.js";
import { SendFriendCompletionNotifications } from "./application/use-cases/delivery/send-friend-completion-notifications.use-case.js";
import { SendMilestoneNotification } from "./application/use-cases/delivery/send-milestone-notification.use-case.js";
import { SendNotificationWithDedup } from "./application/use-cases/delivery/send-notification-with-dedup.use-case.js";
import { SendNotification } from "./application/use-cases/delivery/send-notification.use-case.js";
import { SendNudgeNotification } from "./application/use-cases/delivery/send-nudge-notification.use-case.js";
import { UnregisterPushToken } from "./application/use-cases/delivery/unregister-push-token.use-case.js";

export const notificationAccountCleanupProvider: FactoryProvider<NotificationAccountCleanup> = {
  provide: NotificationAccountCleanup,
  inject: [NOTIFICATION_REPOSITORY, NOTIFICATION_CACHE],
  useFactory: (
    repository: ConstructorParameters<typeof NotificationAccountCleanup>[0]["repository"],
    cache: ConstructorParameters<typeof NotificationAccountCleanup>[0]["cache"],
  ) =>
    new NotificationAccountCleanup({
      repository,
      cache,
      logger: new Logger(NotificationAccountCleanup.name),
    }),
};

export const pushDeliveryAfterCommitPublisherProvider: FactoryProvider<PushDeliveryAfterCommitPublisher> =
  {
    provide: PushDeliveryAfterCommitPublisher,
    inject: [AFTER_COMMIT_TASK_REGISTRY, PublishPushDeliveryOutbox],
    useFactory: (
      afterCommit: ConstructorParameters<typeof PushDeliveryAfterCommitPublisher>[0]["afterCommit"],
      publishOutbox: ConstructorParameters<
        typeof PushDeliveryAfterCommitPublisher
      >[0]["publishOutbox"],
    ) =>
      new PushDeliveryAfterCommitPublisher({
        afterCommit,
        publishOutbox,
        logger: new Logger(PushDeliveryAfterCommitPublisher.name),
      }),
  };

export const pushDeliveryEligibilityServiceProvider: FactoryProvider<PushDeliveryEligibilityService> =
  {
    provide: PushDeliveryEligibilityService,
    inject: [
      USER_NOTIFICATION_SETTINGS,
      PUSH_RATE_LIMITER,
      NOTIFICATION_RECIPIENT_PREFERENCE_READER,
    ],
    useFactory: (
      userSettings: ConstructorParameters<typeof PushDeliveryEligibilityService>[0]["userSettings"],
      rateLimiter: ConstructorParameters<typeof PushDeliveryEligibilityService>[0]["rateLimiter"],
      recipientPreferenceReader: ConstructorParameters<
        typeof PushDeliveryEligibilityService
      >[0]["recipientPreferenceReader"],
    ) =>
      new PushDeliveryEligibilityService({
        userSettings,
        rateLimiter,
        recipientPreferenceReader,
      }),
  };

export const pushNotificationDeliveryServiceProvider: FactoryProvider<PushNotificationDeliveryService> =
  {
    provide: PushNotificationDeliveryService,
    inject: [PUSH_TOKEN_REPOSITORY, PUSH_PROVIDER, ACTIVE_PUSH_TOKEN_READER, NOTIFICATION_CACHE],
    useFactory: (
      pushTokenRepository: ConstructorParameters<
        typeof PushNotificationDeliveryService
      >[0]["pushTokenRepository"],
      pushProvider: ConstructorParameters<
        typeof PushNotificationDeliveryService
      >[0]["pushProvider"],
      activePushTokenReader: ConstructorParameters<
        typeof PushNotificationDeliveryService
      >[0]["activePushTokenReader"],
      notificationCache: ConstructorParameters<
        typeof PushNotificationDeliveryService
      >[0]["notificationCache"],
    ) =>
      new PushNotificationDeliveryService({
        pushTokenRepository,
        pushProvider,
        activePushTokenReader,
        notificationCache,
        logger: new Logger(PushNotificationDeliveryService.name),
      }),
  };

export const pushNotificationPayloadFactoryProvider: FactoryProvider<PushNotificationPayloadFactory> =
  {
    provide: PushNotificationPayloadFactory,
    inject: [MARKETING_PUSH_OPT_OUT_TOKEN],
    useFactory: (
      marketingOptOutTokens: ConstructorParameters<
        typeof PushNotificationPayloadFactory
      >[0]["marketingOptOutTokens"],
    ) => new PushNotificationPayloadFactory({ marketingOptOutTokens }),
  };

export const deliverPushNotificationsProvider: FactoryProvider<DeliverPushNotifications> = {
  provide: DeliverPushNotifications,
  inject: [
    PUSH_DELIVERY_LIFECYCLE_REPOSITORY,
    UNIT_OF_WORK,
    PushDeliveryEligibilityService,
    PushNotificationPayloadFactory,
    PushNotificationDeliveryService,
  ],
  useFactory: (
    lifecycle: ConstructorParameters<typeof DeliverPushNotifications>[0]["lifecycle"],
    unitOfWork: ConstructorParameters<typeof DeliverPushNotifications>[0]["unitOfWork"],
    eligibility: ConstructorParameters<typeof DeliverPushNotifications>[0]["eligibility"],
    payloadFactory: ConstructorParameters<typeof DeliverPushNotifications>[0]["payloadFactory"],
    delivery: ConstructorParameters<typeof DeliverPushNotifications>[0]["delivery"],
  ) =>
    new DeliverPushNotifications({
      lifecycle,
      unitOfWork,
      eligibility,
      payloadFactory,
      delivery,
      logger: new Logger(DeliverPushNotifications.name),
    }),
};

export const finalizeBatchNotificationProvider: FactoryProvider<FinalizeBatchNotification> = {
  provide: FinalizeBatchNotification,
  inject: [NOTIFICATION_CACHE, NOTIFICATION_DEDUP],
  useFactory: (
    cache: ConstructorParameters<typeof FinalizeBatchNotification>[0]["cache"],
    notificationDedup: ConstructorParameters<
      typeof FinalizeBatchNotification
    >[0]["notificationDedup"],
  ) =>
    new FinalizeBatchNotification({
      cache,
      notificationDedup,
      logger: new Logger(FinalizeBatchNotification.name),
    }),
};

export const notificationHistoryReaderProvider: FactoryProvider<NotificationHistoryReader> = {
  provide: NotificationHistoryReader,
  inject: [NOTIFICATION_DEDUP, NOTIFICATION_HISTORY_READER],
  useFactory: (
    notificationDedup: ConstructorParameters<
      typeof NotificationHistoryReader
    >[0]["notificationDedup"],
    notificationHistoryReader: ConstructorParameters<
      typeof NotificationHistoryReader
    >[0]["notificationHistoryReader"],
  ) =>
    new NotificationHistoryReader({
      notificationDedup,
      notificationHistoryReader,
      logger: new Logger(NotificationHistoryReader.name),
    }),
};

export const getNotificationsProvider: FactoryProvider<GetNotifications> = {
  provide: GetNotifications,
  inject: [NOTIFICATION_INBOX_READER, PaginationService],
  useFactory: (
    notificationInboxReader: ConstructorParameters<
      typeof GetNotifications
    >[0]["notificationInboxReader"],
    paginationService: ConstructorParameters<typeof GetNotifications>[0]["paginationService"],
  ) =>
    new GetNotifications({
      notificationInboxReader,
      paginationService,
      logger: new Logger(GetNotifications.name),
    }),
};

export const getUnreadCountProvider: FactoryProvider<GetUnreadCount> = {
  provide: GetUnreadCount,
  inject: [NOTIFICATION_INBOX_READER, NOTIFICATION_CACHE],
  useFactory: (
    notificationInboxReader: ConstructorParameters<
      typeof GetUnreadCount
    >[0]["notificationInboxReader"],
    cache: ConstructorParameters<typeof GetUnreadCount>[0]["cache"],
  ) => new GetUnreadCount({ notificationInboxReader, cache }),
};

export const markAllAsReadProvider: FactoryProvider<MarkAllAsRead> = {
  provide: MarkAllAsRead,
  inject: [NOTIFICATION_REPOSITORY, NOTIFICATION_CACHE],
  useFactory: (
    notificationRepository: ConstructorParameters<
      typeof MarkAllAsRead
    >[0]["notificationRepository"],
    cache: ConstructorParameters<typeof MarkAllAsRead>[0]["cache"],
  ) =>
    new MarkAllAsRead({
      notificationRepository,
      cache,
      logger: new Logger(MarkAllAsRead.name),
    }),
};

export const markAsReadProvider: FactoryProvider<MarkAsRead> = {
  provide: MarkAsRead,
  inject: [NOTIFICATION_INBOX_READER, NOTIFICATION_REPOSITORY, NOTIFICATION_CACHE],
  useFactory: (
    notificationInboxReader: ConstructorParameters<typeof MarkAsRead>[0]["notificationInboxReader"],
    notificationRepository: ConstructorParameters<typeof MarkAsRead>[0]["notificationRepository"],
    cache: ConstructorParameters<typeof MarkAsRead>[0]["cache"],
  ) =>
    new MarkAsRead({
      notificationInboxReader,
      notificationRepository,
      cache,
      logger: new Logger(MarkAsRead.name),
    }),
};

export const markNotificationOpenedProvider: FactoryProvider<MarkNotificationOpened> = {
  provide: MarkNotificationOpened,
  inject: [NOTIFICATION_REPOSITORY, NOTIFICATION_CACHE],
  useFactory: (
    notificationRepository: ConstructorParameters<
      typeof MarkNotificationOpened
    >[0]["notificationRepository"],
    cache: ConstructorParameters<typeof MarkNotificationOpened>[0]["cache"],
  ) =>
    new MarkNotificationOpened({
      notificationRepository,
      cache,
      logger: new Logger(MarkNotificationOpened.name),
    }),
};

export const optOutMarketingPushProvider: FactoryProvider<OptOutMarketingPush> = {
  provide: OptOutMarketingPush,
  inject: [MARKETING_PUSH_OPT_OUT_TOKEN, USER_NOTIFICATION_SETTINGS],
  useFactory: (
    tokens: ConstructorParameters<typeof OptOutMarketingPush>[0]["tokens"],
    settings: ConstructorParameters<typeof OptOutMarketingPush>[0]["settings"],
  ) =>
    new OptOutMarketingPush({
      tokens,
      settings,
      logger: new Logger(OptOutMarketingPush.name),
    }),
};

export const persistBatchNotificationProvider: FactoryProvider<PersistBatchNotification> = {
  provide: PersistBatchNotification,
  inject: [
    NOTIFICATION_REPOSITORY,
    PUSH_DISPATCH_STAGING,
    UNIT_OF_WORK,
    PushDeliveryAfterCommitPublisher,
  ],
  useFactory: (
    notificationRepository: ConstructorParameters<
      typeof PersistBatchNotification
    >[0]["notificationRepository"],
    pushDispatchStaging: ConstructorParameters<
      typeof PersistBatchNotification
    >[0]["pushDispatchStaging"],
    unitOfWork: ConstructorParameters<typeof PersistBatchNotification>[0]["unitOfWork"],
    afterCommitPublisher: ConstructorParameters<
      typeof PersistBatchNotification
    >[0]["afterCommitPublisher"],
  ) =>
    new PersistBatchNotification({
      notificationRepository,
      pushDispatchStaging,
      unitOfWork,
      afterCommitPublisher,
    }),
};

export const publishPushDeliveryOutboxProvider: FactoryProvider<PublishPushDeliveryOutbox> = {
  provide: PublishPushDeliveryOutbox,
  inject: [PUSH_DELIVERY_OUTBOX_REPOSITORY, PUSH_DELIVERY_JOB_ENQUEUER, UNIT_OF_WORK],
  useFactory: (
    outbox: ConstructorParameters<typeof PublishPushDeliveryOutbox>[0]["outbox"],
    enqueuer: ConstructorParameters<typeof PublishPushDeliveryOutbox>[0]["enqueuer"],
    unitOfWork: ConstructorParameters<typeof PublishPushDeliveryOutbox>[0]["unitOfWork"],
  ) =>
    new PublishPushDeliveryOutbox({
      outbox,
      enqueuer,
      unitOfWork,
      logger: new Logger(PublishPushDeliveryOutbox.name),
    }),
};

export const reconcilePushReceiptsProvider: FactoryProvider<ReconcilePushReceipts> = {
  provide: ReconcilePushReceipts,
  inject: [
    PUSH_RECEIPT_REPOSITORY,
    PUSH_TOKEN_REPOSITORY,
    PUSH_PROVIDER,
    NOTIFICATION_CACHE,
    UNIT_OF_WORK,
  ],
  useFactory: (
    pushReceiptRepository: ConstructorParameters<
      typeof ReconcilePushReceipts
    >[0]["pushReceiptRepository"],
    pushTokenRepository: ConstructorParameters<
      typeof ReconcilePushReceipts
    >[0]["pushTokenRepository"],
    pushProvider: ConstructorParameters<typeof ReconcilePushReceipts>[0]["pushProvider"],
    cache: ConstructorParameters<typeof ReconcilePushReceipts>[0]["cache"],
    unitOfWork: ConstructorParameters<typeof ReconcilePushReceipts>[0]["unitOfWork"],
  ) =>
    new ReconcilePushReceipts({
      pushReceiptRepository,
      pushTokenRepository,
      pushProvider,
      cache,
      unitOfWork,
      logger: new Logger(ReconcilePushReceipts.name),
    }),
};

export const recoverFailedPushDeliveriesProvider: FactoryProvider<RecoverFailedPushDeliveries> = {
  provide: RecoverFailedPushDeliveries,
  inject: [PUSH_DELIVERY_LIFECYCLE_REPOSITORY, UNIT_OF_WORK],
  useFactory: (
    lifecycle: ConstructorParameters<typeof RecoverFailedPushDeliveries>[0]["lifecycle"],
    unitOfWork: ConstructorParameters<typeof RecoverFailedPushDeliveries>[0]["unitOfWork"],
  ) => new RecoverFailedPushDeliveries({ lifecycle, unitOfWork }),
};

export const registerPushTokenProvider: FactoryProvider<RegisterPushToken> = {
  provide: RegisterPushToken,
  inject: [PUSH_TOKEN_REPOSITORY, PUSH_PROVIDER, USER_NOTIFICATION_SETTINGS, NOTIFICATION_CACHE],
  useFactory: (
    pushTokenRepository: ConstructorParameters<typeof RegisterPushToken>[0]["pushTokenRepository"],
    pushProvider: ConstructorParameters<typeof RegisterPushToken>[0]["pushProvider"],
    userSettings: ConstructorParameters<typeof RegisterPushToken>[0]["userSettings"],
    cache: ConstructorParameters<typeof RegisterPushToken>[0]["cache"],
  ) =>
    new RegisterPushToken({
      pushTokenRepository,
      pushProvider,
      userSettings,
      cache,
      logger: new Logger(RegisterPushToken.name),
    }),
};

export const relayPushDeliveryOutboxProvider: FactoryProvider<RelayPushDeliveryOutbox> = {
  provide: RelayPushDeliveryOutbox,
  inject: [
    PUSH_DELIVERY_OUTBOX_REPOSITORY,
    PUSH_DELIVERY_LIFECYCLE_REPOSITORY,
    UNIT_OF_WORK,
    PublishPushDeliveryOutbox,
  ],
  useFactory: (
    outbox: ConstructorParameters<typeof RelayPushDeliveryOutbox>[0]["outbox"],
    lifecycle: ConstructorParameters<typeof RelayPushDeliveryOutbox>[0]["lifecycle"],
    unitOfWork: ConstructorParameters<typeof RelayPushDeliveryOutbox>[0]["unitOfWork"],
    publishOutbox: ConstructorParameters<typeof RelayPushDeliveryOutbox>[0]["publishOutbox"],
  ) =>
    new RelayPushDeliveryOutbox({
      outbox,
      lifecycle,
      unitOfWork,
      publishOutbox,
    }),
};

export const sendBatchNotificationProvider: FactoryProvider<SendBatchNotification> = {
  provide: SendBatchNotification,
  inject: [
    PersistBatchNotification,
    FinalizeBatchNotification,
    UNIT_OF_WORK,
    AFTER_COMMIT_TASK_REGISTRY,
  ],
  useFactory: (
    persistBatchNotificationUseCase: ConstructorParameters<
      typeof SendBatchNotification
    >[0]["persistBatchNotificationUseCase"],
    finalizeBatchNotificationUseCase: ConstructorParameters<
      typeof SendBatchNotification
    >[0]["finalizeBatchNotificationUseCase"],
    unitOfWork: ConstructorParameters<typeof SendBatchNotification>[0]["unitOfWork"],
    afterCommitTasks: ConstructorParameters<typeof SendBatchNotification>[0]["afterCommitTasks"],
  ) =>
    new SendBatchNotification({
      persistBatchNotificationUseCase,
      finalizeBatchNotificationUseCase,
      unitOfWork,
      afterCommitTasks,
    }),
};

export const sendBillingIssueNotificationProvider: FactoryProvider<SendBillingIssueNotification> = {
  provide: SendBillingIssueNotification,
  inject: [NotificationPublisher, NOTIFICATION_RECIPIENT_LOCALE_READER],
  useFactory: (
    notificationPublisher: ConstructorParameters<
      typeof SendBillingIssueNotification
    >[0]["notificationPublisher"],
    recipientLocaleReader: ConstructorParameters<
      typeof SendBillingIssueNotification
    >[0]["recipientLocaleReader"],
  ) =>
    new SendBillingIssueNotification({
      notificationPublisher,
      recipientLocaleReader,
      logger: new Logger(SendBillingIssueNotification.name),
    }),
};

export const sendCheerNotificationProvider: FactoryProvider<SendCheerNotification> = {
  provide: SendCheerNotification,
  inject: [NotificationPublisher, NOTIFICATION_RECIPIENT_LOCALE_READER],
  useFactory: (
    notificationPublisher: ConstructorParameters<
      typeof SendCheerNotification
    >[0]["notificationPublisher"],
    recipientLocaleReader: ConstructorParameters<
      typeof SendCheerNotification
    >[0]["recipientLocaleReader"],
  ) =>
    new SendCheerNotification({
      notificationPublisher,
      recipientLocaleReader,
      logger: new Logger(SendCheerNotification.name),
    }),
};

export const sendFollowAcceptedNotificationProvider: FactoryProvider<SendFollowAcceptedNotification> =
  {
    provide: SendFollowAcceptedNotification,
    inject: [NotificationPublisher, NOTIFICATION_RECIPIENT_LOCALE_READER],
    useFactory: (
      notificationPublisher: ConstructorParameters<
        typeof SendFollowAcceptedNotification
      >[0]["notificationPublisher"],
      recipientLocaleReader: ConstructorParameters<
        typeof SendFollowAcceptedNotification
      >[0]["recipientLocaleReader"],
    ) =>
      new SendFollowAcceptedNotification({
        notificationPublisher,
        recipientLocaleReader,
        logger: new Logger(SendFollowAcceptedNotification.name),
      }),
  };

export const sendFollowRequestNotificationProvider: FactoryProvider<SendFollowRequestNotification> =
  {
    provide: SendFollowRequestNotification,
    inject: [NotificationPublisher, NOTIFICATION_RECIPIENT_LOCALE_READER],
    useFactory: (
      notificationPublisher: ConstructorParameters<
        typeof SendFollowRequestNotification
      >[0]["notificationPublisher"],
      recipientLocaleReader: ConstructorParameters<
        typeof SendFollowRequestNotification
      >[0]["recipientLocaleReader"],
    ) =>
      new SendFollowRequestNotification({
        notificationPublisher,
        recipientLocaleReader,
        logger: new Logger(SendFollowRequestNotification.name),
      }),
  };

export const sendFriendCompletionNotificationsProvider: FactoryProvider<SendFriendCompletionNotifications> =
  {
    provide: SendFriendCompletionNotifications,
    inject: [
      NotificationHistoryReader,
      PersistBatchNotification,
      FinalizeBatchNotification,
      UNIT_OF_WORK,
      USER_NOTIFICATION_SETTINGS,
    ],
    useFactory: (
      notificationHistoryReader: ConstructorParameters<
        typeof SendFriendCompletionNotifications
      >[0]["notificationHistoryReader"],
      persistBatch: ConstructorParameters<
        typeof SendFriendCompletionNotifications
      >[0]["persistBatch"],
      finalizeBatch: ConstructorParameters<
        typeof SendFriendCompletionNotifications
      >[0]["finalizeBatch"],
      unitOfWork: ConstructorParameters<typeof SendFriendCompletionNotifications>[0]["unitOfWork"],
      userNotificationSettings: ConstructorParameters<
        typeof SendFriendCompletionNotifications
      >[0]["userNotificationSettings"],
    ) =>
      new SendFriendCompletionNotifications({
        notificationHistoryReader,
        persistBatch,
        finalizeBatch,
        unitOfWork,
        userNotificationSettings,
        logger: new Logger(SendFriendCompletionNotifications.name),
      }),
  };

export const sendMilestoneNotificationProvider: FactoryProvider<SendMilestoneNotification> = {
  provide: SendMilestoneNotification,
  inject: [
    NotificationPublisher,
    NOTIFICATION_RECIPIENT_LOCALE_READER,
    NOTIFICATION_HISTORY_READER,
    NOTIFICATION_DEDUP_LOCK,
  ],
  useFactory: (
    notificationPublisher: ConstructorParameters<
      typeof SendMilestoneNotification
    >[0]["notificationPublisher"],
    recipientLocaleReader: ConstructorParameters<
      typeof SendMilestoneNotification
    >[0]["recipientLocaleReader"],
    notificationHistoryReader: ConstructorParameters<
      typeof SendMilestoneNotification
    >[0]["notificationHistoryReader"],
    notificationDedupLock: ConstructorParameters<
      typeof SendMilestoneNotification
    >[0]["notificationDedupLock"],
  ) =>
    new SendMilestoneNotification({
      notificationPublisher,
      recipientLocaleReader,
      notificationHistoryReader,
      notificationDedupLock,
      logger: new Logger(SendMilestoneNotification.name),
    }),
};

export const sendNotificationProvider: FactoryProvider<SendNotification> = {
  provide: SendNotification,
  inject: [
    NOTIFICATION_REPOSITORY,
    PUSH_DISPATCH_STAGING,
    NOTIFICATION_CACHE,
    UNIT_OF_WORK,
    AFTER_COMMIT_TASK_REGISTRY,
    PushDeliveryAfterCommitPublisher,
  ],
  useFactory: (
    notificationRepository: ConstructorParameters<
      typeof SendNotification
    >[0]["notificationRepository"],
    pushDispatchStaging: ConstructorParameters<typeof SendNotification>[0]["pushDispatchStaging"],
    cache: ConstructorParameters<typeof SendNotification>[0]["cache"],
    unitOfWork: ConstructorParameters<typeof SendNotification>[0]["unitOfWork"],
    afterCommit: ConstructorParameters<typeof SendNotification>[0]["afterCommit"],
    afterCommitPublisher: ConstructorParameters<typeof SendNotification>[0]["afterCommitPublisher"],
  ) =>
    new SendNotification({
      notificationRepository,
      pushDispatchStaging,
      cache,
      unitOfWork,
      afterCommit,
      afterCommitPublisher,
      logger: new Logger(SendNotification.name),
    }),
};

export const sendNotificationWithDedupProvider: FactoryProvider<SendNotificationWithDedup> = {
  provide: SendNotificationWithDedup,
  inject: [SendNotification, NOTIFICATION_DEDUP_LOCK, NOTIFICATION_HISTORY_READER],
  useFactory: (
    sendNotification: ConstructorParameters<
      typeof SendNotificationWithDedup
    >[0]["sendNotification"],
    dedupLock: ConstructorParameters<typeof SendNotificationWithDedup>[0]["dedupLock"],
    notificationHistoryReader: ConstructorParameters<
      typeof SendNotificationWithDedup
    >[0]["notificationHistoryReader"],
  ) =>
    new SendNotificationWithDedup({
      sendNotification,
      dedupLock,
      notificationHistoryReader,
      logger: new Logger(SendNotificationWithDedup.name),
    }),
};

export const sendNudgeNotificationProvider: FactoryProvider<SendNudgeNotification> = {
  provide: SendNudgeNotification,
  inject: [NotificationPublisher, NOTIFICATION_RECIPIENT_LOCALE_READER],
  useFactory: (
    notificationPublisher: ConstructorParameters<
      typeof SendNudgeNotification
    >[0]["notificationPublisher"],
    recipientLocaleReader: ConstructorParameters<
      typeof SendNudgeNotification
    >[0]["recipientLocaleReader"],
  ) =>
    new SendNudgeNotification({
      notificationPublisher,
      recipientLocaleReader,
      logger: new Logger(SendNudgeNotification.name),
    }),
};

export const unregisterPushTokenProvider: FactoryProvider<UnregisterPushToken> = {
  provide: UnregisterPushToken,
  inject: [PUSH_TOKEN_REPOSITORY, NOTIFICATION_CACHE],
  useFactory: (
    pushTokenRepository: ConstructorParameters<
      typeof UnregisterPushToken
    >[0]["pushTokenRepository"],
    cache: ConstructorParameters<typeof UnregisterPushToken>[0]["cache"],
  ) =>
    new UnregisterPushToken({
      pushTokenRepository,
      cache,
      logger: new Logger(UnregisterPushToken.name),
    }),
};

export const notificationPublisherProvider: FactoryProvider<NotificationPublisher> = {
  provide: NotificationPublisher,
  inject: [SendNotification, SendNotificationWithDedup, SendBatchNotification],
  useFactory: (
    sendNotification: ConstructorParameters<typeof NotificationPublisher>[0]["sendNotification"],
    sendNotificationWithDeduplication: ConstructorParameters<
      typeof NotificationPublisher
    >[0]["sendNotificationWithDeduplication"],
    sendBatchNotification: ConstructorParameters<
      typeof NotificationPublisher
    >[0]["sendBatchNotification"],
  ) =>
    new NotificationPublisher({
      sendNotification,
      sendNotificationWithDeduplication,
      sendBatchNotification,
    }),
};
