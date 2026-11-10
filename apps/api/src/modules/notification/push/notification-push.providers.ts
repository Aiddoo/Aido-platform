import { Logger, type FactoryProvider } from "@nestjs/common";

import { PaginationService } from "#api/shared/application/pagination/index";
import { AFTER_COMMIT_TASK_REGISTRY, UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { NotificationHistoryReader } from "../inbox/application/notification-history.reader.js";
import { NOTIFICATION_CACHE } from "../inbox/application/ports/notification-cache.port.js";
import { NOTIFICATION_HISTORY_READER } from "../inbox/application/ports/notification-history.reader.port.js";
import { NOTIFICATION_INBOX_READER } from "../inbox/application/ports/notification-inbox.reader.port.js";
import { NOTIFICATION_REPOSITORY } from "../inbox/application/ports/notification.repository.port.js";
import { DeleteActorNotificationsUseCase } from "../inbox/application/use-cases/delete-actor-notifications.use-case.js";
import { GetUnreadNotificationCountUseCase } from "../inbox/application/use-cases/get-unread-notification-count.use-case.js";
import { ListNotificationsUseCase } from "../inbox/application/use-cases/list-notifications.use-case.js";
import { MarkAllNotificationsReadUseCase } from "../inbox/application/use-cases/mark-all-notifications-read.use-case.js";
import { MarkNotificationOpenedUseCase } from "../inbox/application/use-cases/mark-notification-opened.use-case.js";
import { MarkNotificationReadUseCase } from "../inbox/application/use-cases/mark-notification-read.use-case.js";
import { ACTIVE_PUSH_TOKEN_READER } from "./application/ports/active-push-token.reader.port.js";
import { MARKETING_CONSENT_RECONFIRM_ACCESS } from "./application/ports/marketing-consent-reconfirm.port.js";
import { MARKETING_PUSH_OPT_OUT_TOKEN } from "./application/ports/marketing-push-opt-out-token.port.js";
import {
  NOTIFICATION_DEDUP,
  NOTIFICATION_DEDUP_LOCK,
} from "./application/ports/notification-dedup.port.js";
import { NOTIFICATION_RECIPIENT_LOCALE_READER } from "./application/ports/notification-recipient-locale.reader.port.js";
import { NOTIFICATION_RECIPIENT_PREFERENCE_READER } from "./application/ports/notification-recipient-preference.reader.port.js";
import { NOTIFICATION_RECIPIENT_TIMEZONE_READER } from "./application/ports/notification-recipient-timezone.reader.port.js";
import { NOTIFICATION_TODO_TARGET_READER } from "./application/ports/notification-todo-target.reader.port.js";
import { PUSH_DELIVERY_JOB_ENQUEUER } from "./application/ports/push-delivery-job-enqueuer.port.js";
import { PUSH_DELIVERY_LIFECYCLE_REPOSITORY } from "./application/ports/push-delivery-lifecycle.repository.port.js";
import { PUSH_DELIVERY_OUTBOX_REPOSITORY } from "./application/ports/push-delivery-outbox.repository.port.js";
import { PUSH_DEVICE_REPOSITORY } from "./application/ports/push-device.repository.port.js";
import { PUSH_DISPATCH_STAGING } from "./application/ports/push-dispatch-staging.repository.port.js";
import { PUSH_PROVIDER } from "./application/ports/push-provider.port.js";
import { PUSH_RATE_LIMITER } from "./application/ports/push-rate-limiter.port.js";
import { PUSH_RECEIPT_REPOSITORY } from "./application/ports/push-receipt.repository.port.js";
import { PUSH_TOKEN_REPOSITORY } from "./application/ports/push-token.repository.port.js";
import { USER_NOTIFICATION_SETTINGS } from "./application/ports/user-notification-settings.port.js";
import { PushNotificationPayloadMapper } from "./application/push-notification-payload.mapper.js";
import { PushQuietHoursReader } from "./application/push-quiet-hours.reader.js";
import { DeliverPushNotificationsUseCase } from "./application/use-cases/deliver-push-notifications.use-case.js";
import { DispatchPushNotificationUseCase } from "./application/use-cases/dispatch-push-notification.use-case.js";
import { EvaluatePushDeliveryEligibilityUseCase } from "./application/use-cases/evaluate-push-delivery-eligibility.use-case.js";
import { FinalizeBatchNotificationUseCase } from "./application/use-cases/finalize-batch-notification.use-case.js";
import { OptOutMarketingPushUseCase } from "./application/use-cases/opt-out-marketing-push.use-case.js";
import { PersistBatchNotificationUseCase } from "./application/use-cases/persist-batch-notification.use-case.js";
import { PublishNotificationUseCase } from "./application/use-cases/publish-notification.use-case.js";
import { PublishPushDeliveryAfterCommitUseCase } from "./application/use-cases/publish-push-delivery-after-commit.use-case.js";
import { PublishPushDeliveryOutboxUseCase } from "./application/use-cases/publish-push-delivery-outbox.use-case.js";
import { ReconcilePushReceiptsUseCase } from "./application/use-cases/reconcile-push-receipts.use-case.js";
import { ReconfirmMarketingConsentsUseCase } from "./application/use-cases/reconfirm-marketing-consents.use-case.js";
import { RecoverFailedPushDeliveriesUseCase } from "./application/use-cases/recover-failed-push-deliveries.use-case.js";
import { RelayPushDeliveryOutboxUseCase } from "./application/use-cases/relay-push-delivery-outbox.use-case.js";
import { ReleaseSessionPushDevicesUseCase } from "./application/use-cases/release-session-push-devices.use-case.js";
import { ReportPushDeviceUseCase } from "./application/use-cases/report-push-device.use-case.js";
import { SendBatchNotificationUseCase } from "./application/use-cases/send-batch-notification.use-case.js";
import { SendBillingIssueNotificationUseCase } from "./application/use-cases/send-billing-issue-notification.use-case.js";
import { SendCheerNotificationUseCase } from "./application/use-cases/send-cheer-notification.use-case.js";
import { SendFollowAcceptedNotificationUseCase } from "./application/use-cases/send-follow-accepted-notification.use-case.js";
import { SendFollowRequestNotificationUseCase } from "./application/use-cases/send-follow-request-notification.use-case.js";
import { SendFriendCompletionNotificationsUseCase } from "./application/use-cases/send-friend-completion-notifications.use-case.js";
import { SendMilestoneNotificationUseCase } from "./application/use-cases/send-milestone-notification.use-case.js";
import { SendNotificationWithDedupUseCase } from "./application/use-cases/send-notification-with-dedup.use-case.js";
import { SendNotificationUseCase } from "./application/use-cases/send-notification.use-case.js";
import { SendNudgeNotificationUseCase } from "./application/use-cases/send-nudge-notification.use-case.js";
import { UnregisterPushDeviceUseCase } from "./application/use-cases/unregister-push-device.use-case.js";

export const deleteActorNotificationsUseCaseProvider: FactoryProvider<DeleteActorNotificationsUseCase> =
  {
    provide: DeleteActorNotificationsUseCase,
    inject: [NOTIFICATION_REPOSITORY, NOTIFICATION_CACHE],
    useFactory: (
      repository: ConstructorParameters<typeof DeleteActorNotificationsUseCase>[0]["repository"],
      cache: ConstructorParameters<typeof DeleteActorNotificationsUseCase>[0]["cache"],
    ) =>
      new DeleteActorNotificationsUseCase({
        repository,
        cache,
        logger: new Logger(DeleteActorNotificationsUseCase.name),
      }),
  };

export const publishPushDeliveryAfterCommitUseCaseProvider: FactoryProvider<PublishPushDeliveryAfterCommitUseCase> =
  {
    provide: PublishPushDeliveryAfterCommitUseCase,
    inject: [AFTER_COMMIT_TASK_REGISTRY, PublishPushDeliveryOutboxUseCase],
    useFactory: (
      afterCommit: ConstructorParameters<
        typeof PublishPushDeliveryAfterCommitUseCase
      >[0]["afterCommit"],
      publishOutbox: ConstructorParameters<
        typeof PublishPushDeliveryAfterCommitUseCase
      >[0]["publishOutbox"],
    ) =>
      new PublishPushDeliveryAfterCommitUseCase({
        afterCommit,
        publishOutbox,
        logger: new Logger(PublishPushDeliveryAfterCommitUseCase.name),
      }),
  };

export const pushQuietHoursReaderProvider: FactoryProvider<PushQuietHoursReader> = {
  provide: PushQuietHoursReader,
  inject: [USER_NOTIFICATION_SETTINGS],
  useFactory: (
    userSettings: ConstructorParameters<typeof PushQuietHoursReader>[0]["userSettings"],
  ) => new PushQuietHoursReader({ userSettings }),
};

export const evaluatePushDeliveryEligibilityUseCaseProvider: FactoryProvider<EvaluatePushDeliveryEligibilityUseCase> =
  {
    provide: EvaluatePushDeliveryEligibilityUseCase,
    inject: [
      USER_NOTIFICATION_SETTINGS,
      PUSH_RATE_LIMITER,
      NOTIFICATION_RECIPIENT_PREFERENCE_READER,
    ],
    useFactory: (
      userSettings: ConstructorParameters<
        typeof EvaluatePushDeliveryEligibilityUseCase
      >[0]["userSettings"],
      rateLimiter: ConstructorParameters<
        typeof EvaluatePushDeliveryEligibilityUseCase
      >[0]["rateLimiter"],
      recipientPreferenceReader: ConstructorParameters<
        typeof EvaluatePushDeliveryEligibilityUseCase
      >[0]["recipientPreferenceReader"],
    ) =>
      new EvaluatePushDeliveryEligibilityUseCase({
        userSettings,
        rateLimiter,
        recipientPreferenceReader,
      }),
  };

export const dispatchPushNotificationUseCaseProvider: FactoryProvider<DispatchPushNotificationUseCase> =
  {
    provide: DispatchPushNotificationUseCase,
    inject: [
      PUSH_TOKEN_REPOSITORY,
      PUSH_DEVICE_REPOSITORY,
      PUSH_PROVIDER,
      ACTIVE_PUSH_TOKEN_READER,
      NOTIFICATION_CACHE,
    ],
    useFactory: (
      pushTokenRepository: ConstructorParameters<
        typeof DispatchPushNotificationUseCase
      >[0]["pushTokenRepository"],
      pushDeviceRepository: ConstructorParameters<
        typeof DispatchPushNotificationUseCase
      >[0]["pushDeviceRepository"],
      pushProvider: ConstructorParameters<
        typeof DispatchPushNotificationUseCase
      >[0]["pushProvider"],
      activePushTokenReader: ConstructorParameters<
        typeof DispatchPushNotificationUseCase
      >[0]["activePushTokenReader"],
      notificationCache: ConstructorParameters<
        typeof DispatchPushNotificationUseCase
      >[0]["notificationCache"],
    ) =>
      new DispatchPushNotificationUseCase({
        pushTokenRepository,
        pushDeviceRepository,
        pushProvider,
        activePushTokenReader,
        notificationCache,
        logger: new Logger(DispatchPushNotificationUseCase.name),
      }),
  };

export const pushNotificationPayloadMapperProvider: FactoryProvider<PushNotificationPayloadMapper> =
  {
    provide: PushNotificationPayloadMapper,
    inject: [MARKETING_PUSH_OPT_OUT_TOKEN],
    useFactory: (
      marketingOptOutTokens: ConstructorParameters<
        typeof PushNotificationPayloadMapper
      >[0]["marketingOptOutTokens"],
    ) => new PushNotificationPayloadMapper({ marketingOptOutTokens }),
  };

export const deliverPushNotificationsUseCaseProvider: FactoryProvider<DeliverPushNotificationsUseCase> =
  {
    provide: DeliverPushNotificationsUseCase,
    inject: [
      PUSH_DELIVERY_LIFECYCLE_REPOSITORY,
      UNIT_OF_WORK,
      EvaluatePushDeliveryEligibilityUseCase,
      PushNotificationPayloadMapper,
      DispatchPushNotificationUseCase,
    ],
    useFactory: (
      lifecycle: ConstructorParameters<typeof DeliverPushNotificationsUseCase>[0]["lifecycle"],
      unitOfWork: ConstructorParameters<typeof DeliverPushNotificationsUseCase>[0]["unitOfWork"],
      eligibility: ConstructorParameters<typeof DeliverPushNotificationsUseCase>[0]["eligibility"],
      payloadFactory: ConstructorParameters<
        typeof DeliverPushNotificationsUseCase
      >[0]["payloadFactory"],
      delivery: ConstructorParameters<typeof DeliverPushNotificationsUseCase>[0]["delivery"],
    ) =>
      new DeliverPushNotificationsUseCase({
        lifecycle,
        unitOfWork,
        eligibility,
        payloadFactory,
        delivery,
        logger: new Logger(DeliverPushNotificationsUseCase.name),
      }),
  };

export const finalizeBatchNotificationUseCaseProvider: FactoryProvider<FinalizeBatchNotificationUseCase> =
  {
    provide: FinalizeBatchNotificationUseCase,
    inject: [NOTIFICATION_CACHE, NOTIFICATION_DEDUP],
    useFactory: (
      cache: ConstructorParameters<typeof FinalizeBatchNotificationUseCase>[0]["cache"],
      notificationDedup: ConstructorParameters<
        typeof FinalizeBatchNotificationUseCase
      >[0]["notificationDedup"],
    ) =>
      new FinalizeBatchNotificationUseCase({
        cache,
        notificationDedup,
        logger: new Logger(FinalizeBatchNotificationUseCase.name),
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

export const listNotificationsUseCaseProvider: FactoryProvider<ListNotificationsUseCase> = {
  provide: ListNotificationsUseCase,
  inject: [NOTIFICATION_INBOX_READER, PaginationService],
  useFactory: (
    notificationInboxReader: ConstructorParameters<
      typeof ListNotificationsUseCase
    >[0]["notificationInboxReader"],
    paginationService: ConstructorParameters<
      typeof ListNotificationsUseCase
    >[0]["paginationService"],
  ) =>
    new ListNotificationsUseCase({
      notificationInboxReader,
      paginationService,
      logger: new Logger(ListNotificationsUseCase.name),
    }),
};

export const getUnreadNotificationCountUseCaseProvider: FactoryProvider<GetUnreadNotificationCountUseCase> =
  {
    provide: GetUnreadNotificationCountUseCase,
    inject: [NOTIFICATION_INBOX_READER, NOTIFICATION_CACHE],
    useFactory: (
      notificationInboxReader: ConstructorParameters<
        typeof GetUnreadNotificationCountUseCase
      >[0]["notificationInboxReader"],
      cache: ConstructorParameters<typeof GetUnreadNotificationCountUseCase>[0]["cache"],
    ) => new GetUnreadNotificationCountUseCase({ notificationInboxReader, cache }),
  };

export const markAllNotificationsReadUseCaseProvider: FactoryProvider<MarkAllNotificationsReadUseCase> =
  {
    provide: MarkAllNotificationsReadUseCase,
    inject: [NOTIFICATION_REPOSITORY, NOTIFICATION_CACHE],
    useFactory: (
      notificationRepository: ConstructorParameters<
        typeof MarkAllNotificationsReadUseCase
      >[0]["notificationRepository"],
      cache: ConstructorParameters<typeof MarkAllNotificationsReadUseCase>[0]["cache"],
    ) =>
      new MarkAllNotificationsReadUseCase({
        notificationRepository,
        cache,
        logger: new Logger(MarkAllNotificationsReadUseCase.name),
      }),
  };

export const markNotificationReadUseCaseProvider: FactoryProvider<MarkNotificationReadUseCase> = {
  provide: MarkNotificationReadUseCase,
  inject: [NOTIFICATION_INBOX_READER, NOTIFICATION_REPOSITORY, NOTIFICATION_CACHE],
  useFactory: (
    notificationInboxReader: ConstructorParameters<
      typeof MarkNotificationReadUseCase
    >[0]["notificationInboxReader"],
    notificationRepository: ConstructorParameters<
      typeof MarkNotificationReadUseCase
    >[0]["notificationRepository"],
    cache: ConstructorParameters<typeof MarkNotificationReadUseCase>[0]["cache"],
  ) =>
    new MarkNotificationReadUseCase({
      notificationInboxReader,
      notificationRepository,
      cache,
      logger: new Logger(MarkNotificationReadUseCase.name),
    }),
};

export const markNotificationOpenedUseCaseProvider: FactoryProvider<MarkNotificationOpenedUseCase> =
  {
    provide: MarkNotificationOpenedUseCase,
    inject: [NOTIFICATION_REPOSITORY, NOTIFICATION_CACHE],
    useFactory: (
      notificationRepository: ConstructorParameters<
        typeof MarkNotificationOpenedUseCase
      >[0]["notificationRepository"],
      cache: ConstructorParameters<typeof MarkNotificationOpenedUseCase>[0]["cache"],
    ) =>
      new MarkNotificationOpenedUseCase({
        notificationRepository,
        cache,
        logger: new Logger(MarkNotificationOpenedUseCase.name),
      }),
  };

export const optOutMarketingPushUseCaseProvider: FactoryProvider<OptOutMarketingPushUseCase> = {
  provide: OptOutMarketingPushUseCase,
  inject: [MARKETING_PUSH_OPT_OUT_TOKEN, USER_NOTIFICATION_SETTINGS],
  useFactory: (
    tokens: ConstructorParameters<typeof OptOutMarketingPushUseCase>[0]["tokens"],
    settings: ConstructorParameters<typeof OptOutMarketingPushUseCase>[0]["settings"],
  ) =>
    new OptOutMarketingPushUseCase({
      tokens,
      settings,
      logger: new Logger(OptOutMarketingPushUseCase.name),
    }),
};

export const persistBatchNotificationUseCaseProvider: FactoryProvider<PersistBatchNotificationUseCase> =
  {
    provide: PersistBatchNotificationUseCase,
    inject: [
      NOTIFICATION_REPOSITORY,
      PUSH_DISPATCH_STAGING,
      UNIT_OF_WORK,
      PublishPushDeliveryAfterCommitUseCase,
    ],
    useFactory: (
      notificationRepository: ConstructorParameters<
        typeof PersistBatchNotificationUseCase
      >[0]["notificationRepository"],
      pushDispatchStaging: ConstructorParameters<
        typeof PersistBatchNotificationUseCase
      >[0]["pushDispatchStaging"],
      unitOfWork: ConstructorParameters<typeof PersistBatchNotificationUseCase>[0]["unitOfWork"],
      afterCommitPublisher: ConstructorParameters<
        typeof PersistBatchNotificationUseCase
      >[0]["afterCommitPublisher"],
    ) =>
      new PersistBatchNotificationUseCase({
        notificationRepository,
        pushDispatchStaging,
        unitOfWork,
        afterCommitPublisher,
      }),
  };

export const publishPushDeliveryOutboxUseCaseProvider: FactoryProvider<PublishPushDeliveryOutboxUseCase> =
  {
    provide: PublishPushDeliveryOutboxUseCase,
    inject: [PUSH_DELIVERY_OUTBOX_REPOSITORY, PUSH_DELIVERY_JOB_ENQUEUER, UNIT_OF_WORK],
    useFactory: (
      outbox: ConstructorParameters<typeof PublishPushDeliveryOutboxUseCase>[0]["outbox"],
      enqueuer: ConstructorParameters<typeof PublishPushDeliveryOutboxUseCase>[0]["enqueuer"],
      unitOfWork: ConstructorParameters<typeof PublishPushDeliveryOutboxUseCase>[0]["unitOfWork"],
    ) =>
      new PublishPushDeliveryOutboxUseCase({
        outbox,
        enqueuer,
        unitOfWork,
        logger: new Logger(PublishPushDeliveryOutboxUseCase.name),
      }),
  };

export const reconcilePushReceiptsUseCaseProvider: FactoryProvider<ReconcilePushReceiptsUseCase> = {
  provide: ReconcilePushReceiptsUseCase,
  inject: [
    PUSH_RECEIPT_REPOSITORY,
    PUSH_TOKEN_REPOSITORY,
    PUSH_PROVIDER,
    NOTIFICATION_CACHE,
    UNIT_OF_WORK,
  ],
  useFactory: (
    pushReceiptRepository: ConstructorParameters<
      typeof ReconcilePushReceiptsUseCase
    >[0]["pushReceiptRepository"],
    pushTokenRepository: ConstructorParameters<
      typeof ReconcilePushReceiptsUseCase
    >[0]["pushTokenRepository"],
    pushProvider: ConstructorParameters<typeof ReconcilePushReceiptsUseCase>[0]["pushProvider"],
    cache: ConstructorParameters<typeof ReconcilePushReceiptsUseCase>[0]["cache"],
    unitOfWork: ConstructorParameters<typeof ReconcilePushReceiptsUseCase>[0]["unitOfWork"],
  ) =>
    new ReconcilePushReceiptsUseCase({
      pushReceiptRepository,
      pushTokenRepository,
      pushProvider,
      cache,
      unitOfWork,
      logger: new Logger(ReconcilePushReceiptsUseCase.name),
    }),
};

export const recoverFailedPushDeliveriesUseCaseProvider: FactoryProvider<RecoverFailedPushDeliveriesUseCase> =
  {
    provide: RecoverFailedPushDeliveriesUseCase,
    inject: [PUSH_DELIVERY_LIFECYCLE_REPOSITORY, UNIT_OF_WORK],
    useFactory: (
      lifecycle: ConstructorParameters<typeof RecoverFailedPushDeliveriesUseCase>[0]["lifecycle"],
      unitOfWork: ConstructorParameters<typeof RecoverFailedPushDeliveriesUseCase>[0]["unitOfWork"],
    ) => new RecoverFailedPushDeliveriesUseCase({ lifecycle, unitOfWork }),
  };

export const releaseSessionPushDevicesUseCaseProvider: FactoryProvider<ReleaseSessionPushDevicesUseCase> =
  {
    provide: ReleaseSessionPushDevicesUseCase,
    inject: [PUSH_DEVICE_REPOSITORY, PUSH_TOKEN_REPOSITORY, UNIT_OF_WORK, NOTIFICATION_CACHE],
    useFactory: (
      pushDeviceRepository: ConstructorParameters<
        typeof ReleaseSessionPushDevicesUseCase
      >[0]["pushDeviceRepository"],
      pushTokenRepository: ConstructorParameters<
        typeof ReleaseSessionPushDevicesUseCase
      >[0]["pushTokenRepository"],
      unitOfWork: ConstructorParameters<typeof ReleaseSessionPushDevicesUseCase>[0]["unitOfWork"],
      cache: ConstructorParameters<typeof ReleaseSessionPushDevicesUseCase>[0]["cache"],
    ) =>
      new ReleaseSessionPushDevicesUseCase({
        pushDeviceRepository,
        pushTokenRepository,
        unitOfWork,
        cache,
        logger: new Logger(ReleaseSessionPushDevicesUseCase.name),
      }),
  };

export const reportPushDeviceUseCaseProvider: FactoryProvider<ReportPushDeviceUseCase> = {
  provide: ReportPushDeviceUseCase,
  inject: [
    PUSH_DEVICE_REPOSITORY,
    PUSH_TOKEN_REPOSITORY,
    UNIT_OF_WORK,
    PUSH_PROVIDER,
    USER_NOTIFICATION_SETTINGS,
    NOTIFICATION_CACHE,
  ],
  useFactory: (
    pushDeviceRepository: ConstructorParameters<
      typeof ReportPushDeviceUseCase
    >[0]["pushDeviceRepository"],
    pushTokenRepository: ConstructorParameters<
      typeof ReportPushDeviceUseCase
    >[0]["pushTokenRepository"],
    unitOfWork: ConstructorParameters<typeof ReportPushDeviceUseCase>[0]["unitOfWork"],
    pushProvider: ConstructorParameters<typeof ReportPushDeviceUseCase>[0]["pushProvider"],
    userSettings: ConstructorParameters<typeof ReportPushDeviceUseCase>[0]["userSettings"],
    cache: ConstructorParameters<typeof ReportPushDeviceUseCase>[0]["cache"],
  ) =>
    new ReportPushDeviceUseCase({
      pushDeviceRepository,
      pushTokenRepository,
      unitOfWork,
      pushProvider,
      userSettings,
      cache,
      logger: new Logger(ReportPushDeviceUseCase.name),
    }),
};

export const relayPushDeliveryOutboxUseCaseProvider: FactoryProvider<RelayPushDeliveryOutboxUseCase> =
  {
    provide: RelayPushDeliveryOutboxUseCase,
    inject: [
      PUSH_DELIVERY_OUTBOX_REPOSITORY,
      PUSH_DELIVERY_LIFECYCLE_REPOSITORY,
      UNIT_OF_WORK,
      PublishPushDeliveryOutboxUseCase,
    ],
    useFactory: (
      outbox: ConstructorParameters<typeof RelayPushDeliveryOutboxUseCase>[0]["outbox"],
      lifecycle: ConstructorParameters<typeof RelayPushDeliveryOutboxUseCase>[0]["lifecycle"],
      unitOfWork: ConstructorParameters<typeof RelayPushDeliveryOutboxUseCase>[0]["unitOfWork"],
      publishOutbox: ConstructorParameters<
        typeof RelayPushDeliveryOutboxUseCase
      >[0]["publishOutbox"],
    ) =>
      new RelayPushDeliveryOutboxUseCase({
        outbox,
        lifecycle,
        unitOfWork,
        publishOutbox,
      }),
  };

export const sendBatchNotificationUseCaseProvider: FactoryProvider<SendBatchNotificationUseCase> = {
  provide: SendBatchNotificationUseCase,
  inject: [
    PersistBatchNotificationUseCase,
    FinalizeBatchNotificationUseCase,
    UNIT_OF_WORK,
    AFTER_COMMIT_TASK_REGISTRY,
  ],
  useFactory: (
    persistBatchNotificationUseCase: ConstructorParameters<
      typeof SendBatchNotificationUseCase
    >[0]["persistBatchNotificationUseCase"],
    finalizeBatchNotificationUseCase: ConstructorParameters<
      typeof SendBatchNotificationUseCase
    >[0]["finalizeBatchNotificationUseCase"],
    unitOfWork: ConstructorParameters<typeof SendBatchNotificationUseCase>[0]["unitOfWork"],
    afterCommitTasks: ConstructorParameters<
      typeof SendBatchNotificationUseCase
    >[0]["afterCommitTasks"],
  ) =>
    new SendBatchNotificationUseCase({
      persistBatchNotificationUseCase,
      finalizeBatchNotificationUseCase,
      unitOfWork,
      afterCommitTasks,
    }),
};

export const reconfirmMarketingConsentsUseCaseProvider: FactoryProvider<ReconfirmMarketingConsentsUseCase> =
  {
    provide: ReconfirmMarketingConsentsUseCase,
    inject: [
      MARKETING_CONSENT_RECONFIRM_ACCESS,
      NOTIFICATION_RECIPIENT_LOCALE_READER,
      NOTIFICATION_RECIPIENT_TIMEZONE_READER,
      PushQuietHoursReader,
      PublishNotificationUseCase,
      UNIT_OF_WORK,
    ],
    useFactory: (
      reconfirmAccess: ConstructorParameters<
        typeof ReconfirmMarketingConsentsUseCase
      >[0]["reconfirmAccess"],
      localeReader: ConstructorParameters<
        typeof ReconfirmMarketingConsentsUseCase
      >[0]["localeReader"],
      timezoneReader: ConstructorParameters<
        typeof ReconfirmMarketingConsentsUseCase
      >[0]["timezoneReader"],
      quietHoursReader: ConstructorParameters<
        typeof ReconfirmMarketingConsentsUseCase
      >[0]["quietHoursReader"],
      notificationPublisher: ConstructorParameters<
        typeof ReconfirmMarketingConsentsUseCase
      >[0]["notificationPublisher"],
      unitOfWork: ConstructorParameters<typeof ReconfirmMarketingConsentsUseCase>[0]["unitOfWork"],
    ) =>
      new ReconfirmMarketingConsentsUseCase({
        reconfirmAccess,
        localeReader,
        timezoneReader,
        quietHoursReader,
        notificationPublisher,
        unitOfWork,
        logger: new Logger(ReconfirmMarketingConsentsUseCase.name),
      }),
  };

export const sendBillingIssueNotificationUseCaseProvider: FactoryProvider<SendBillingIssueNotificationUseCase> =
  {
    provide: SendBillingIssueNotificationUseCase,
    inject: [PublishNotificationUseCase, NOTIFICATION_RECIPIENT_LOCALE_READER],
    useFactory: (
      notificationPublisher: ConstructorParameters<
        typeof SendBillingIssueNotificationUseCase
      >[0]["notificationPublisher"],
      recipientLocaleReader: ConstructorParameters<
        typeof SendBillingIssueNotificationUseCase
      >[0]["recipientLocaleReader"],
    ) =>
      new SendBillingIssueNotificationUseCase({
        notificationPublisher,
        recipientLocaleReader,
        logger: new Logger(SendBillingIssueNotificationUseCase.name),
      }),
  };

export const sendCheerNotificationUseCaseProvider: FactoryProvider<SendCheerNotificationUseCase> = {
  provide: SendCheerNotificationUseCase,
  inject: [PublishNotificationUseCase, NOTIFICATION_RECIPIENT_LOCALE_READER],
  useFactory: (
    notificationPublisher: ConstructorParameters<
      typeof SendCheerNotificationUseCase
    >[0]["notificationPublisher"],
    recipientLocaleReader: ConstructorParameters<
      typeof SendCheerNotificationUseCase
    >[0]["recipientLocaleReader"],
  ) =>
    new SendCheerNotificationUseCase({
      notificationPublisher,
      recipientLocaleReader,
      logger: new Logger(SendCheerNotificationUseCase.name),
    }),
};

export const sendFollowAcceptedNotificationUseCaseProvider: FactoryProvider<SendFollowAcceptedNotificationUseCase> =
  {
    provide: SendFollowAcceptedNotificationUseCase,
    inject: [PublishNotificationUseCase, NOTIFICATION_RECIPIENT_LOCALE_READER],
    useFactory: (
      notificationPublisher: ConstructorParameters<
        typeof SendFollowAcceptedNotificationUseCase
      >[0]["notificationPublisher"],
      recipientLocaleReader: ConstructorParameters<
        typeof SendFollowAcceptedNotificationUseCase
      >[0]["recipientLocaleReader"],
    ) =>
      new SendFollowAcceptedNotificationUseCase({
        notificationPublisher,
        recipientLocaleReader,
        logger: new Logger(SendFollowAcceptedNotificationUseCase.name),
      }),
  };

export const sendFollowRequestNotificationUseCaseProvider: FactoryProvider<SendFollowRequestNotificationUseCase> =
  {
    provide: SendFollowRequestNotificationUseCase,
    inject: [PublishNotificationUseCase, NOTIFICATION_RECIPIENT_LOCALE_READER],
    useFactory: (
      notificationPublisher: ConstructorParameters<
        typeof SendFollowRequestNotificationUseCase
      >[0]["notificationPublisher"],
      recipientLocaleReader: ConstructorParameters<
        typeof SendFollowRequestNotificationUseCase
      >[0]["recipientLocaleReader"],
    ) =>
      new SendFollowRequestNotificationUseCase({
        notificationPublisher,
        recipientLocaleReader,
        logger: new Logger(SendFollowRequestNotificationUseCase.name),
      }),
  };

export const sendFriendCompletionNotificationsUseCaseProvider: FactoryProvider<SendFriendCompletionNotificationsUseCase> =
  {
    provide: SendFriendCompletionNotificationsUseCase,
    inject: [
      NotificationHistoryReader,
      PersistBatchNotificationUseCase,
      FinalizeBatchNotificationUseCase,
      UNIT_OF_WORK,
      USER_NOTIFICATION_SETTINGS,
    ],
    useFactory: (
      notificationHistoryReader: ConstructorParameters<
        typeof SendFriendCompletionNotificationsUseCase
      >[0]["notificationHistoryReader"],
      persistBatch: ConstructorParameters<
        typeof SendFriendCompletionNotificationsUseCase
      >[0]["persistBatch"],
      finalizeBatch: ConstructorParameters<
        typeof SendFriendCompletionNotificationsUseCase
      >[0]["finalizeBatch"],
      unitOfWork: ConstructorParameters<
        typeof SendFriendCompletionNotificationsUseCase
      >[0]["unitOfWork"],
      userNotificationSettings: ConstructorParameters<
        typeof SendFriendCompletionNotificationsUseCase
      >[0]["userNotificationSettings"],
    ) =>
      new SendFriendCompletionNotificationsUseCase({
        notificationHistoryReader,
        persistBatch,
        finalizeBatch,
        unitOfWork,
        userNotificationSettings,
        logger: new Logger(SendFriendCompletionNotificationsUseCase.name),
      }),
  };

export const sendMilestoneNotificationUseCaseProvider: FactoryProvider<SendMilestoneNotificationUseCase> =
  {
    provide: SendMilestoneNotificationUseCase,
    inject: [
      PublishNotificationUseCase,
      NOTIFICATION_RECIPIENT_LOCALE_READER,
      NOTIFICATION_HISTORY_READER,
      NOTIFICATION_DEDUP_LOCK,
    ],
    useFactory: (
      notificationPublisher: ConstructorParameters<
        typeof SendMilestoneNotificationUseCase
      >[0]["notificationPublisher"],
      recipientLocaleReader: ConstructorParameters<
        typeof SendMilestoneNotificationUseCase
      >[0]["recipientLocaleReader"],
      notificationHistoryReader: ConstructorParameters<
        typeof SendMilestoneNotificationUseCase
      >[0]["notificationHistoryReader"],
      notificationDedupLock: ConstructorParameters<
        typeof SendMilestoneNotificationUseCase
      >[0]["notificationDedupLock"],
    ) =>
      new SendMilestoneNotificationUseCase({
        notificationPublisher,
        recipientLocaleReader,
        notificationHistoryReader,
        notificationDedupLock,
        logger: new Logger(SendMilestoneNotificationUseCase.name),
      }),
  };

export const sendNotificationUseCaseProvider: FactoryProvider<SendNotificationUseCase> = {
  provide: SendNotificationUseCase,
  inject: [
    NOTIFICATION_REPOSITORY,
    PUSH_DISPATCH_STAGING,
    NOTIFICATION_CACHE,
    UNIT_OF_WORK,
    AFTER_COMMIT_TASK_REGISTRY,
    PublishPushDeliveryAfterCommitUseCase,
  ],
  useFactory: (
    notificationRepository: ConstructorParameters<
      typeof SendNotificationUseCase
    >[0]["notificationRepository"],
    pushDispatchStaging: ConstructorParameters<
      typeof SendNotificationUseCase
    >[0]["pushDispatchStaging"],
    cache: ConstructorParameters<typeof SendNotificationUseCase>[0]["cache"],
    unitOfWork: ConstructorParameters<typeof SendNotificationUseCase>[0]["unitOfWork"],
    afterCommit: ConstructorParameters<typeof SendNotificationUseCase>[0]["afterCommit"],
    afterCommitPublisher: ConstructorParameters<
      typeof SendNotificationUseCase
    >[0]["afterCommitPublisher"],
  ) =>
    new SendNotificationUseCase({
      notificationRepository,
      pushDispatchStaging,
      cache,
      unitOfWork,
      afterCommit,
      afterCommitPublisher,
      logger: new Logger(SendNotificationUseCase.name),
    }),
};

export const sendNotificationWithDedupUseCaseProvider: FactoryProvider<SendNotificationWithDedupUseCase> =
  {
    provide: SendNotificationWithDedupUseCase,
    inject: [SendNotificationUseCase, NOTIFICATION_DEDUP_LOCK, NOTIFICATION_HISTORY_READER],
    useFactory: (
      sendNotification: ConstructorParameters<
        typeof SendNotificationWithDedupUseCase
      >[0]["sendNotification"],
      dedupLock: ConstructorParameters<typeof SendNotificationWithDedupUseCase>[0]["dedupLock"],
      notificationHistoryReader: ConstructorParameters<
        typeof SendNotificationWithDedupUseCase
      >[0]["notificationHistoryReader"],
    ) =>
      new SendNotificationWithDedupUseCase({
        sendNotification,
        dedupLock,
        notificationHistoryReader,
        logger: new Logger(SendNotificationWithDedupUseCase.name),
      }),
  };

export const sendNudgeNotificationUseCaseProvider: FactoryProvider<SendNudgeNotificationUseCase> = {
  provide: SendNudgeNotificationUseCase,
  inject: [PublishNotificationUseCase, NOTIFICATION_RECIPIENT_LOCALE_READER],
  useFactory: (
    notificationPublisher: ConstructorParameters<
      typeof SendNudgeNotificationUseCase
    >[0]["notificationPublisher"],
    recipientLocaleReader: ConstructorParameters<
      typeof SendNudgeNotificationUseCase
    >[0]["recipientLocaleReader"],
  ) =>
    new SendNudgeNotificationUseCase({
      notificationPublisher,
      recipientLocaleReader,
      logger: new Logger(SendNudgeNotificationUseCase.name),
    }),
};

export const unregisterPushDeviceUseCaseProvider: FactoryProvider<UnregisterPushDeviceUseCase> = {
  provide: UnregisterPushDeviceUseCase,
  inject: [PUSH_DEVICE_REPOSITORY, PUSH_TOKEN_REPOSITORY, UNIT_OF_WORK, NOTIFICATION_CACHE],
  useFactory: (
    pushDeviceRepository: ConstructorParameters<
      typeof UnregisterPushDeviceUseCase
    >[0]["pushDeviceRepository"],
    pushTokenRepository: ConstructorParameters<
      typeof UnregisterPushDeviceUseCase
    >[0]["pushTokenRepository"],
    unitOfWork: ConstructorParameters<typeof UnregisterPushDeviceUseCase>[0]["unitOfWork"],
    cache: ConstructorParameters<typeof UnregisterPushDeviceUseCase>[0]["cache"],
  ) =>
    new UnregisterPushDeviceUseCase({
      pushDeviceRepository,
      pushTokenRepository,
      unitOfWork,
      cache,
      logger: new Logger(UnregisterPushDeviceUseCase.name),
    }),
};

export const publishNotificationUseCaseProvider: FactoryProvider<PublishNotificationUseCase> = {
  provide: PublishNotificationUseCase,
  inject: [
    SendNotificationUseCase,
    SendNotificationWithDedupUseCase,
    SendBatchNotificationUseCase,
    NOTIFICATION_TODO_TARGET_READER,
  ],
  useFactory: (
    sendNotification: ConstructorParameters<
      typeof PublishNotificationUseCase
    >[0]["sendNotification"],
    sendNotificationWithDeduplication: ConstructorParameters<
      typeof PublishNotificationUseCase
    >[0]["sendNotificationWithDeduplication"],
    sendBatchNotification: ConstructorParameters<
      typeof PublishNotificationUseCase
    >[0]["sendBatchNotification"],
    todoTargetReader: ConstructorParameters<
      typeof PublishNotificationUseCase
    >[0]["todoTargetReader"],
  ) =>
    new PublishNotificationUseCase({
      sendNotification,
      sendNotificationWithDeduplication,
      sendBatchNotification,
      todoTargetReader,
    }),
};
