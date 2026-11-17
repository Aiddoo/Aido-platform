import type { Provider } from "@nestjs/common";

import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import {
  NotificationRecipientLocaleReaderPort,
  NotificationRecipientTimezoneReaderPort,
  PublishPushDeliveryAfterCommitUseCase,
  PushDispatchStagingRepositoryPort,
  PushQuietHoursReaderPort,
} from "../push-dispatches/notification-push-dispatches.public.js";
import { UserNotificationSettingsPort } from "../shared/application/ports/user-notification-settings.port.js";
import { NotificationHistoryReader } from "./application/notification-history.reader.js";
import { MarketingConsentReconfirmPort } from "./application/ports/marketing-consent-reconfirm.port.js";
import { NotificationCachePort } from "./application/ports/notification-cache.port.js";
import { NotificationDeduplicationPort } from "./application/ports/notification-deduplication.port.js";
import { NotificationHistoryReaderPort } from "./application/ports/notification-history.reader.port.js";
import { NotificationInboxReaderPort } from "./application/ports/notification-inbox.reader.port.js";
import { NotificationTodoTargetReaderPort } from "./application/ports/notification-todo-target.reader.port.js";
import { NotificationRepositoryPort } from "./application/ports/notification.repository.port.js";
import { DeleteActorNotificationsUseCase } from "./application/use-cases/delete-actor-notifications.use-case.js";
import { FinalizeBatchNotificationUseCase } from "./application/use-cases/finalize-batch-notification.use-case.js";
import { GetUnreadNotificationCountUseCase } from "./application/use-cases/get-unread-notification-count.use-case.js";
import { ListNotificationsUseCase } from "./application/use-cases/list-notifications.use-case.js";
import { MarkAllNotificationsReadUseCase } from "./application/use-cases/mark-all-notifications-read.use-case.js";
import { MarkNotificationOpenedUseCase } from "./application/use-cases/mark-notification-opened.use-case.js";
import { MarkNotificationReadUseCase } from "./application/use-cases/mark-notification-read.use-case.js";
import { PersistBatchNotificationUseCase } from "./application/use-cases/persist-batch-notification.use-case.js";
import { PublishDeduplicatedNotificationUseCase } from "./application/use-cases/publish-deduplicated-notification.use-case.js";
import { PublishNotificationBatchUseCase } from "./application/use-cases/publish-notification-batch.use-case.js";
import { PublishNotificationUseCase } from "./application/use-cases/publish-notification.use-case.js";
import { ReconfirmMarketingConsentsUseCase } from "./application/use-cases/reconfirm-marketing-consents.use-case.js";
import { SendBatchNotificationUseCase } from "./application/use-cases/send-batch-notification.use-case.js";
import { SendBillingIssueNotificationUseCase } from "./application/use-cases/send-billing-issue-notification.use-case.js";
import { SendCheerNotificationUseCase } from "./application/use-cases/send-cheer-notification.use-case.js";
import { SendFollowAcceptedNotificationUseCase } from "./application/use-cases/send-follow-accepted-notification.use-case.js";
import { SendFollowRequestNotificationUseCase } from "./application/use-cases/send-follow-request-notification.use-case.js";
import { SendFriendCompletionNotificationsUseCase } from "./application/use-cases/send-friend-completion-notifications.use-case.js";
import { SendMilestoneNotificationUseCase } from "./application/use-cases/send-milestone-notification.use-case.js";
import { SendNotificationWithDeduplicationUseCase } from "./application/use-cases/send-notification-with-deduplication.use-case.js";
import { SendNotificationUseCase } from "./application/use-cases/send-notification.use-case.js";
import { SendNudgeNotificationUseCase } from "./application/use-cases/send-nudge-notification.use-case.js";
import { MarketingConsentReconfirmAdapter } from "./infrastructure/adapters/marketing-consent-reconfirm.adapter.js";
import { NotificationDeduplicationAdapter } from "./infrastructure/adapters/notification-deduplication.adapter.js";
import { NotificationCacheAdapter } from "./infrastructure/cache/notification-cache.adapter.js";
import { DrizzleNotificationTodoTargetReader } from "./infrastructure/persistence/drizzle-notification-todo-target.reader.js";
import { DrizzleNotificationReader } from "./infrastructure/persistence/drizzle-notification.reader.js";
import { DrizzleNotificationRepository } from "./infrastructure/persistence/drizzle-notification.repository.js";

// 테스트 하네스가 발송·설정 어댑터만 바꿔 끼우도록 저장소·조회 어댑터를 따로 묶는다
export const NOTIFICATION_NOTIFICATIONS_PERSISTENCE_PROVIDERS = [
  { provide: NotificationRepositoryPort, useClass: DrizzleNotificationRepository },
  // 조회기 하나가 알림함 목록과 중복 발송 이력을 함께 맡는다
  DrizzleNotificationReader,
  { provide: NotificationInboxReaderPort, useExisting: DrizzleNotificationReader },
  { provide: NotificationHistoryReaderPort, useExisting: DrizzleNotificationReader },
  { provide: NotificationCachePort, useClass: NotificationCacheAdapter },
  { provide: NotificationDeduplicationPort, useClass: NotificationDeduplicationAdapter },
  { provide: NotificationTodoTargetReaderPort, useClass: DrizzleNotificationTodoTargetReader },
  { provide: MarketingConsentReconfirmPort, useClass: MarketingConsentReconfirmAdapter },
] satisfies Provider[];

export const NOTIFICATION_NOTIFICATIONS_USE_CASE_PROVIDERS = [
  provideUseCase(ListNotificationsUseCase, {
    notificationInboxReader: NotificationInboxReaderPort,
    logger: loggerFor(ListNotificationsUseCase),
  }),
  provideUseCase(GetUnreadNotificationCountUseCase, {
    notificationInboxReader: NotificationInboxReaderPort,
    cache: NotificationCachePort,
  }),
  provideUseCase(MarkNotificationReadUseCase, {
    notificationRepository: NotificationRepositoryPort,
    cache: NotificationCachePort,
    clock: ClockPort,
    logger: loggerFor(MarkNotificationReadUseCase),
  }),
  provideUseCase(MarkNotificationOpenedUseCase, {
    notificationRepository: NotificationRepositoryPort,
    cache: NotificationCachePort,
    clock: ClockPort,
    logger: loggerFor(MarkNotificationOpenedUseCase),
  }),
  provideUseCase(MarkAllNotificationsReadUseCase, {
    notificationRepository: NotificationRepositoryPort,
    cache: NotificationCachePort,
    clock: ClockPort,
    logger: loggerFor(MarkAllNotificationsReadUseCase),
  }),
  provideUseCase(DeleteActorNotificationsUseCase, {
    repository: NotificationRepositoryPort,
    cache: NotificationCachePort,
    logger: loggerFor(DeleteActorNotificationsUseCase),
  }),
  provideUseCase(NotificationHistoryReader, {
    notificationDeduplication: NotificationDeduplicationPort,
    notificationHistoryReader: NotificationHistoryReaderPort,
    logger: loggerFor(NotificationHistoryReader),
  }),
  provideUseCase(SendNotificationUseCase, {
    notificationRepository: NotificationRepositoryPort,
    pushDispatchStaging: PushDispatchStagingRepositoryPort,
    cache: NotificationCachePort,
    unitOfWork: UnitOfWorkPort,
    afterCommit: AfterCommitTaskRegistryPort,
    afterCommitPublisher: PublishPushDeliveryAfterCommitUseCase,
    logger: loggerFor(SendNotificationUseCase),
  }),
  provideUseCase(SendNotificationWithDeduplicationUseCase, {
    sendNotification: SendNotificationUseCase,
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    notificationHistoryReader: NotificationHistoryReaderPort,
    clock: ClockPort,
    logger: loggerFor(SendNotificationWithDeduplicationUseCase),
  }),
  provideUseCase(PersistBatchNotificationUseCase, {
    notificationRepository: NotificationRepositoryPort,
    pushDispatchStaging: PushDispatchStagingRepositoryPort,
    unitOfWork: UnitOfWorkPort,
    afterCommitPublisher: PublishPushDeliveryAfterCommitUseCase,
  }),
  provideUseCase(FinalizeBatchNotificationUseCase, {
    cache: NotificationCachePort,
    notificationDeduplication: NotificationDeduplicationPort,
    logger: loggerFor(FinalizeBatchNotificationUseCase),
  }),
  provideUseCase(SendBatchNotificationUseCase, {
    persistBatchNotificationUseCase: PersistBatchNotificationUseCase,
    finalizeBatchNotificationUseCase: FinalizeBatchNotificationUseCase,
    unitOfWork: UnitOfWorkPort,
    afterCommitTasks: AfterCommitTaskRegistryPort,
  }),
  provideUseCase(PublishNotificationUseCase, {
    sendNotification: SendNotificationUseCase,
    todoTargetReader: NotificationTodoTargetReaderPort,
  }),
  provideUseCase(PublishDeduplicatedNotificationUseCase, {
    sendNotificationWithDeduplication: SendNotificationWithDeduplicationUseCase,
    todoTargetReader: NotificationTodoTargetReaderPort,
  }),
  provideUseCase(PublishNotificationBatchUseCase, {
    sendBatchNotification: SendBatchNotificationUseCase,
    todoTargetReader: NotificationTodoTargetReaderPort,
  }),
  provideUseCase(SendFollowRequestNotificationUseCase, {
    notificationPublisher: PublishDeduplicatedNotificationUseCase,
    recipientLocaleReader: NotificationRecipientLocaleReaderPort,
    logger: loggerFor(SendFollowRequestNotificationUseCase),
  }),
  provideUseCase(SendFollowAcceptedNotificationUseCase, {
    notificationPublisher: PublishDeduplicatedNotificationUseCase,
    recipientLocaleReader: NotificationRecipientLocaleReaderPort,
    logger: loggerFor(SendFollowAcceptedNotificationUseCase),
  }),
  provideUseCase(SendNudgeNotificationUseCase, {
    notificationPublisher: PublishDeduplicatedNotificationUseCase,
    recipientLocaleReader: NotificationRecipientLocaleReaderPort,
    logger: loggerFor(SendNudgeNotificationUseCase),
  }),
  provideUseCase(SendCheerNotificationUseCase, {
    notificationPublisher: PublishDeduplicatedNotificationUseCase,
    recipientLocaleReader: NotificationRecipientLocaleReaderPort,
    logger: loggerFor(SendCheerNotificationUseCase),
  }),
  provideUseCase(SendBillingIssueNotificationUseCase, {
    notificationPublisher: PublishNotificationUseCase,
    recipientLocaleReader: NotificationRecipientLocaleReaderPort,
    logger: loggerFor(SendBillingIssueNotificationUseCase),
  }),
  provideUseCase(SendMilestoneNotificationUseCase, {
    notificationPublisher: PublishNotificationUseCase,
    recipientLocaleReader: NotificationRecipientLocaleReaderPort,
    notificationHistoryReader: NotificationHistoryReaderPort,
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    logger: loggerFor(SendMilestoneNotificationUseCase),
  }),
  provideUseCase(SendFriendCompletionNotificationsUseCase, {
    notificationHistoryReader: NotificationHistoryReader,
    persistBatch: PersistBatchNotificationUseCase,
    finalizeBatch: FinalizeBatchNotificationUseCase,
    unitOfWork: UnitOfWorkPort,
    userNotificationSettings: UserNotificationSettingsPort,
    clock: ClockPort,
    logger: loggerFor(SendFriendCompletionNotificationsUseCase),
  }),
  provideUseCase(ReconfirmMarketingConsentsUseCase, {
    reconfirmAccess: MarketingConsentReconfirmPort,
    localeReader: NotificationRecipientLocaleReaderPort,
    timezoneReader: NotificationRecipientTimezoneReaderPort,
    quietHoursReader: PushQuietHoursReaderPort,
    notificationPublisher: PublishNotificationBatchUseCase,
    unitOfWork: UnitOfWorkPort,
    logger: loggerFor(ReconfirmMarketingConsentsUseCase),
  }),
] satisfies Provider[];

export const NOTIFICATION_NOTIFICATIONS_PROVIDERS = [
  ...NOTIFICATION_NOTIFICATIONS_PERSISTENCE_PROVIDERS,
  ...NOTIFICATION_NOTIFICATIONS_USE_CASE_PROVIDERS,
] satisfies Provider[];
