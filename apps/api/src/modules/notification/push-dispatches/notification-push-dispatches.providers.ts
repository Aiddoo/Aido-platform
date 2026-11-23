import type { Provider } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import type { Redis } from "ioredis";

import { DRIZZLE, type Database } from "#api/platform/database/database.client";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { REDIS_COMMAND_CLIENT } from "#api/platform/redis/redis.constants";
import { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { UnreadNotificationCountReaderPort } from "../notifications/notification-notifications-queries.public.js";
import {
  ActivePushTokenReaderPort,
  PushDeviceRepositoryPort,
  PushTokenCachePort,
  PushTokenRepositoryPort,
} from "../push-devices/notification-push-devices.public.js";
import { UserNotificationSettingsPort } from "../shared/application/ports/user-notification-settings.port.js";
import { MarketingPushOptOutTokenPort } from "./application/ports/marketing-push-opt-out-token.port.js";
import { NotificationRecipientLocaleReaderPort } from "./application/ports/notification-recipient-locale.reader.port.js";
import { NotificationRecipientPreferenceReaderPort } from "./application/ports/notification-recipient-preference.reader.port.js";
import { NotificationRecipientTimezoneReaderPort } from "./application/ports/notification-recipient-timezone.reader.port.js";
import { PushCampaignOutcomeReaderPort } from "./application/ports/push-campaign-outcome.reader.port.js";
import { PushChannelRegistryPort } from "./application/ports/push-channel-registry.port.js";
import { PushDeliveryClaimRepositoryPort } from "./application/ports/push-delivery-claim.repository.port.js";
import { PushDeliveryFinalizationRepositoryPort } from "./application/ports/push-delivery-finalization.repository.port.js";
import { PushDeliveryHistoryRepositoryPort } from "./application/ports/push-delivery-history.repository.port.js";
import { PushDeliveryJobEnqueuerPort } from "./application/ports/push-delivery-job-enqueuer.port.js";
import { PushDeliveryLeaseRepositoryPort } from "./application/ports/push-delivery-lease.repository.port.js";
import { PushDeliveryOutboxRepositoryPort } from "./application/ports/push-delivery-outbox.repository.port.js";
import { PushDispatchRepositoryPort } from "./application/ports/push-dispatch.repository.port.js";
import { PushNotificationPayloadPort } from "./application/ports/push-notification-payload.port.js";
import { PushQuietHoursReaderPort } from "./application/ports/push-quiet-hours.reader.port.js";
import { PushRateLimiterPort } from "./application/ports/push-rate-limiter.port.js";
import { PushReceiptRepositoryPort } from "./application/ports/push-receipt.repository.port.js";
import { DeliverPushBatchUseCase } from "./application/use-cases/deliver-push-batch.use-case.js";
import { DeliverPushNotificationsUseCase } from "./application/use-cases/deliver-push-notifications.use-case.js";
import { DeliverSinglePushUseCase } from "./application/use-cases/deliver-single-push.use-case.js";
import { DispatchPushNotificationUseCase } from "./application/use-cases/dispatch-push-notification.use-case.js";
import { EvaluateBatchPushDeliverySettingsUseCase } from "./application/use-cases/evaluate-batch-push-delivery-settings.use-case.js";
import { EvaluatePushDeliveryEligibilityUseCase } from "./application/use-cases/evaluate-push-delivery-eligibility.use-case.js";
import { FinalizeSkippedPushDeliveriesUseCase } from "./application/use-cases/finalize-skipped-push-deliveries.use-case.js";
import { LoadPushDeliveryRecipientUseCase } from "./application/use-cases/load-push-delivery-recipient.use-case.js";
import { LoadPushDeliveryRecipientsUseCase } from "./application/use-cases/load-push-delivery-recipients.use-case.js";
import { MarkPushRateLimitReservedUseCase } from "./application/use-cases/mark-push-rate-limit-reserved.use-case.js";
import { OptOutMarketingPushUseCase } from "./application/use-cases/opt-out-marketing-push.use-case.js";
import { PreparePushBatchUseCase } from "./application/use-cases/prepare-push-batch.use-case.js";
import { PublishPushDeliveryAfterCommitUseCase } from "./application/use-cases/publish-push-delivery-after-commit.use-case.js";
import { PublishPushDeliveryOutboxUseCase } from "./application/use-cases/publish-push-delivery-outbox.use-case.js";
import { PurgePushDeliveryHistoryUseCase } from "./application/use-cases/purge-push-delivery-history.use-case.js";
import { ReconcilePushReceiptsUseCase } from "./application/use-cases/reconcile-push-receipts.use-case.js";
import { RecoverFailedPushDeliveriesUseCase } from "./application/use-cases/recover-failed-push-deliveries.use-case.js";
import { RelayPushDeliveryOutboxUseCase } from "./application/use-cases/relay-push-delivery-outbox.use-case.js";
import { ReserveBatchPushRateLimitsUseCase } from "./application/use-cases/reserve-batch-push-rate-limits.use-case.js";
import { ResolveNoActiveTokenReasonsUseCase } from "./application/use-cases/resolve-no-active-token-reasons.use-case.js";
import { SendPushBatchUseCase } from "./application/use-cases/send-push-batch.use-case.js";
import { SendPushMessagesUseCase } from "./application/use-cases/send-push-messages.use-case.js";
import { CachedNotificationRecipientPreferenceAdapter } from "./infrastructure/adapters/cached-notification-recipient-preference.adapter.js";
import { ExpoPushChannelAdapter } from "./infrastructure/adapters/expo-push-channel.adapter.js";
import { HmacMarketingPushOptOutTokenAdapter } from "./infrastructure/adapters/hmac-marketing-push-opt-out-token.adapter.js";
import { PostgresPushRateLimiterAdapter } from "./infrastructure/adapters/postgres-push-rate-limiter.adapter.js";
import { PushChannelRegistryAdapter } from "./infrastructure/adapters/push-channel-registry.adapter.js";
import { PushNotificationPayloadMapper } from "./infrastructure/adapters/push-notification-payload.mapper.js";
import { PushQuietHoursReaderAdapter } from "./infrastructure/adapters/push-quiet-hours-reader.adapter.js";
import { selectPushRateLimiter } from "./infrastructure/adapters/push-rate-limiter-factory.adapter.js";
import { PushDeliveryQueueAdapter } from "./infrastructure/jobs/push-delivery-queue.adapter.js";
import { DrizzlePushCampaignOutcomeReader } from "./infrastructure/persistence/drizzle-push-campaign-outcome.reader.js";
import { DrizzlePushDeliveryClaimRepository } from "./infrastructure/persistence/drizzle-push-delivery-claim.repository.js";
import { DrizzlePushDeliveryFinalizationRepository } from "./infrastructure/persistence/drizzle-push-delivery-finalization.repository.js";
import { DrizzlePushDeliveryHistoryRepository } from "./infrastructure/persistence/drizzle-push-delivery-history.repository.js";
import { DrizzlePushDeliveryLeaseRepository } from "./infrastructure/persistence/drizzle-push-delivery-lease.repository.js";
import { DrizzlePushDeliveryOutboxRepository } from "./infrastructure/persistence/drizzle-push-delivery-outbox.repository.js";
import { DrizzlePushDispatchRepository } from "./infrastructure/persistence/drizzle-push-dispatch.repository.js";
import { DrizzlePushReceiptRepository } from "./infrastructure/persistence/drizzle-push-receipt.repository.js";
import { notificationPushDispatchesConfig } from "./notification-push-dispatches.config.js";

// 운영은 PostgreSQL, 설정으로 Redis·메모리를 고른다
const postgresPushRateLimiterProvider = {
  provide: PostgresPushRateLimiterAdapter,
  useFactory: (database: Database, clock: ClockPort) =>
    new PostgresPushRateLimiterAdapter(database, clock),
  inject: [DRIZZLE, ClockPort],
} satisfies Provider;

const pushRateLimiterProvider = {
  provide: PushRateLimiterPort,
  useFactory: (
    config: ConfigType<typeof notificationPushDispatchesConfig>,
    postgres: PostgresPushRateLimiterAdapter,
    redis?: Redis,
  ): PushRateLimiterPort =>
    selectPushRateLimiter(config.rateLimitBackend, { postgres, ...(redis && { redis }) }),
  inject: [
    notificationPushDispatchesConfig.KEY,
    PostgresPushRateLimiterAdapter,
    { token: REDIS_COMMAND_CLIENT, optional: true },
  ],
} satisfies Provider;

// 테스트 하네스가 공급자·한도기만 바꿔 끼우도록 저장소·조회 어댑터를 따로 묶는다
export const NOTIFICATION_PUSH_DISPATCHES_PERSISTENCE_PROVIDERS = [
  { provide: PushReceiptRepositoryPort, useClass: DrizzlePushReceiptRepository },
  { provide: PushDispatchRepositoryPort, useClass: DrizzlePushDispatchRepository },
  { provide: PushDeliveryOutboxRepositoryPort, useClass: DrizzlePushDeliveryOutboxRepository },
  { provide: PushDeliveryClaimRepositoryPort, useClass: DrizzlePushDeliveryClaimRepository },
  {
    provide: PushDeliveryFinalizationRepositoryPort,
    useClass: DrizzlePushDeliveryFinalizationRepository,
  },
  { provide: PushDeliveryLeaseRepositoryPort, useClass: DrizzlePushDeliveryLeaseRepository },
  { provide: PushCampaignOutcomeReaderPort, useClass: DrizzlePushCampaignOutcomeReader },
  { provide: PushDeliveryHistoryRepositoryPort, useClass: DrizzlePushDeliveryHistoryRepository },
  { provide: PushDeliveryJobEnqueuerPort, useClass: PushDeliveryQueueAdapter },
  // 캐시한 수신자 설정 하나가 설정·언어·시간대 조회 포트를 함께 맡는다
  CachedNotificationRecipientPreferenceAdapter,
  {
    provide: NotificationRecipientPreferenceReaderPort,
    useExisting: CachedNotificationRecipientPreferenceAdapter,
  },
  {
    provide: NotificationRecipientLocaleReaderPort,
    useExisting: CachedNotificationRecipientPreferenceAdapter,
  },
  {
    provide: NotificationRecipientTimezoneReaderPort,
    useExisting: CachedNotificationRecipientPreferenceAdapter,
  },
] satisfies Provider[];

// 새 채널은 어댑터를 inject 목록과 생성자 배열에 더한다
const pushChannelRegistryProvider = {
  provide: PushChannelRegistryPort,
  useFactory: (expo: ExpoPushChannelAdapter) => new PushChannelRegistryAdapter([expo]),
  inject: [ExpoPushChannelAdapter],
} satisfies Provider;

const NOTIFICATION_PUSH_DISPATCHES_EXTERNAL_PROVIDERS = [
  ExpoPushChannelAdapter,
  pushChannelRegistryProvider,
  postgresPushRateLimiterProvider,
  pushRateLimiterProvider,
  { provide: MarketingPushOptOutTokenPort, useClass: HmacMarketingPushOptOutTokenAdapter },
] satisfies Provider[];

export const NOTIFICATION_PUSH_DISPATCHES_USE_CASE_PROVIDERS = [
  provideUseCase(PushQuietHoursReaderAdapter, { userSettings: UserNotificationSettingsPort }),
  { provide: PushQuietHoursReaderPort, useExisting: PushQuietHoursReaderAdapter },
  {
    provide: PushNotificationPayloadPort,
    useFactory: (marketingOptOutTokens: MarketingPushOptOutTokenPort) =>
      new PushNotificationPayloadMapper({ marketingOptOutTokens }),
    inject: [MarketingPushOptOutTokenPort],
  },
  provideUseCase(ResolveNoActiveTokenReasonsUseCase, {
    pushDeviceRepository: PushDeviceRepositoryPort,
    clock: ClockPort,
  }),
  provideUseCase(LoadPushDeliveryRecipientUseCase, {
    recipientPreferenceReader: NotificationRecipientPreferenceReaderPort,
    clock: ClockPort,
  }),
  provideUseCase(LoadPushDeliveryRecipientsUseCase, {
    userSettings: UserNotificationSettingsPort,
    clock: ClockPort,
  }),
  provideUseCase(EvaluatePushDeliveryEligibilityUseCase, {
    userSettings: UserNotificationSettingsPort,
    rateLimiter: PushRateLimiterPort,
    clock: ClockPort,
  }),
  provideUseCase(EvaluateBatchPushDeliverySettingsUseCase, { clock: ClockPort }),
  provideUseCase(ReserveBatchPushRateLimitsUseCase, {
    rateLimiter: PushRateLimiterPort,
    clock: ClockPort,
  }),
  provideUseCase(MarkPushRateLimitReservedUseCase, {
    claims: PushDeliveryClaimRepositoryPort,
    unitOfWork: UnitOfWorkPort,
    clock: ClockPort,
  }),
  provideUseCase(FinalizeSkippedPushDeliveriesUseCase, {
    finalization: PushDeliveryFinalizationRepositoryPort,
    unitOfWork: UnitOfWorkPort,
    logger: loggerFor(FinalizeSkippedPushDeliveriesUseCase),
  }),
  provideUseCase(SendPushMessagesUseCase, { channels: PushChannelRegistryPort }),
  provideUseCase(DispatchPushNotificationUseCase, {
    pushTokenRepository: PushTokenRepositoryPort,
    sendMessages: SendPushMessagesUseCase,
    unreadCounts: UnreadNotificationCountReaderPort,
    activePushTokenReader: ActivePushTokenReaderPort,
    pushTokenCache: PushTokenCachePort,
    noActiveTokenReasons: ResolveNoActiveTokenReasonsUseCase,
    clock: ClockPort,
    logger: loggerFor(DispatchPushNotificationUseCase),
  }),
  provideUseCase(PreparePushBatchUseCase, {
    pushTokenRepository: PushTokenRepositoryPort,
    activePushTokenReader: ActivePushTokenReaderPort,
    noActiveTokenReasons: ResolveNoActiveTokenReasonsUseCase,
    unreadCounts: UnreadNotificationCountReaderPort,
  }),
  provideUseCase(SendPushBatchUseCase, {
    pushTokenRepository: PushTokenRepositoryPort,
    sendMessages: SendPushMessagesUseCase,
    pushTokenCache: PushTokenCachePort,
    clock: ClockPort,
    logger: loggerFor(SendPushBatchUseCase),
  }),
  provideUseCase(DeliverSinglePushUseCase, {
    loadRecipient: LoadPushDeliveryRecipientUseCase,
    evaluateEligibility: EvaluatePushDeliveryEligibilityUseCase,
    markRateLimitReserved: MarkPushRateLimitReservedUseCase,
    payloadFactory: PushNotificationPayloadPort,
    dispatchPush: DispatchPushNotificationUseCase,
    finalizeSkipped: FinalizeSkippedPushDeliveriesUseCase,
    finalization: PushDeliveryFinalizationRepositoryPort,
    unitOfWork: UnitOfWorkPort,
  }),
  provideUseCase(DeliverPushBatchUseCase, {
    loadRecipients: LoadPushDeliveryRecipientsUseCase,
    evaluateSettings: EvaluateBatchPushDeliverySettingsUseCase,
    reserveRateLimits: ReserveBatchPushRateLimitsUseCase,
    markRateLimitReserved: MarkPushRateLimitReservedUseCase,
    payloadFactory: PushNotificationPayloadPort,
    preparePushBatch: PreparePushBatchUseCase,
    sendPushBatch: SendPushBatchUseCase,
    finalizeSkipped: FinalizeSkippedPushDeliveriesUseCase,
    finalization: PushDeliveryFinalizationRepositoryPort,
    unitOfWork: UnitOfWorkPort,
  }),
  provideUseCase(DeliverPushNotificationsUseCase, {
    claims: PushDeliveryClaimRepositoryPort,
    lease: PushDeliveryLeaseRepositoryPort,
    unitOfWork: UnitOfWorkPort,
    deliverSingle: DeliverSinglePushUseCase,
    deliverBatch: DeliverPushBatchUseCase,
    clock: ClockPort,
    logger: loggerFor(DeliverPushNotificationsUseCase),
  }),
  provideUseCase(PublishPushDeliveryOutboxUseCase, {
    outbox: PushDeliveryOutboxRepositoryPort,
    enqueuer: PushDeliveryJobEnqueuerPort,
    unitOfWork: UnitOfWorkPort,
    clock: ClockPort,
    logger: loggerFor(PublishPushDeliveryOutboxUseCase),
  }),
  provideUseCase(PublishPushDeliveryAfterCommitUseCase, {
    afterCommit: AfterCommitTaskRegistryPort,
    publishOutbox: PublishPushDeliveryOutboxUseCase,
    logger: loggerFor(PublishPushDeliveryAfterCommitUseCase),
  }),
  provideUseCase(RecoverFailedPushDeliveriesUseCase, {
    claims: PushDeliveryClaimRepositoryPort,
    unitOfWork: UnitOfWorkPort,
    clock: ClockPort,
  }),
  provideUseCase(RelayPushDeliveryOutboxUseCase, {
    outbox: PushDeliveryOutboxRepositoryPort,
    lease: PushDeliveryLeaseRepositoryPort,
    unitOfWork: UnitOfWorkPort,
    publishOutbox: PublishPushDeliveryOutboxUseCase,
    channels: PushChannelRegistryPort,
    clock: ClockPort,
  }),
  provideUseCase(ReconcilePushReceiptsUseCase, {
    pushReceiptRepository: PushReceiptRepositoryPort,
    pushTokenRepository: PushTokenRepositoryPort,
    channels: PushChannelRegistryPort,
    cache: PushTokenCachePort,
    unitOfWork: UnitOfWorkPort,
    clock: ClockPort,
    logger: loggerFor(ReconcilePushReceiptsUseCase),
    alert: OperationalAlertPort,
  }),
  provideUseCase(PurgePushDeliveryHistoryUseCase, {
    history: PushDeliveryHistoryRepositoryPort,
    clock: ClockPort,
    logger: loggerFor(PurgePushDeliveryHistoryUseCase),
  }),
  provideUseCase(OptOutMarketingPushUseCase, {
    tokens: MarketingPushOptOutTokenPort,
    settings: UserNotificationSettingsPort,
    clock: ClockPort,
    logger: loggerFor(OptOutMarketingPushUseCase),
  }),
] satisfies Provider[];

export const NOTIFICATION_PUSH_DISPATCHES_PROVIDERS = [
  ...NOTIFICATION_PUSH_DISPATCHES_PERSISTENCE_PROVIDERS,
  ...NOTIFICATION_PUSH_DISPATCHES_EXTERNAL_PROVIDERS,
  ...NOTIFICATION_PUSH_DISPATCHES_USE_CASE_PROVIDERS,
] satisfies Provider[];
