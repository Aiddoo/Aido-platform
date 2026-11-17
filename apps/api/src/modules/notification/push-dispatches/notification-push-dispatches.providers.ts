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
import { PushDeliveryClaimRepositoryPort } from "./application/ports/push-delivery-claim.repository.port.js";
import { PushDeliveryFinalizationRepositoryPort } from "./application/ports/push-delivery-finalization.repository.port.js";
import { PushDeliveryJobEnqueuerPort } from "./application/ports/push-delivery-job-enqueuer.port.js";
import { PushDeliveryLeaseRepositoryPort } from "./application/ports/push-delivery-lease.repository.port.js";
import { PushDeliveryOutboxRepositoryPort } from "./application/ports/push-delivery-outbox.repository.port.js";
import { PushDispatchRepositoryPort } from "./application/ports/push-dispatch.repository.port.js";
import { PushNotificationPayloadPort } from "./application/ports/push-notification-payload.port.js";
import { PushProviderPort } from "./application/ports/push-provider.port.js";
import { PushQuietHoursReaderPort } from "./application/ports/push-quiet-hours.reader.port.js";
import { PushRateLimiterPort } from "./application/ports/push-rate-limiter.port.js";
import { PushReceiptRepositoryPort } from "./application/ports/push-receipt.repository.port.js";
import { PushQuietHoursReader } from "./application/push-quiet-hours.reader.js";
import { DeliverPushNotificationsUseCase } from "./application/use-cases/deliver-push-notifications.use-case.js";
import { DispatchPushNotificationUseCase } from "./application/use-cases/dispatch-push-notification.use-case.js";
import { EvaluatePushDeliveryEligibilityUseCase } from "./application/use-cases/evaluate-push-delivery-eligibility.use-case.js";
import { OptOutMarketingPushUseCase } from "./application/use-cases/opt-out-marketing-push.use-case.js";
import { PublishPushDeliveryAfterCommitUseCase } from "./application/use-cases/publish-push-delivery-after-commit.use-case.js";
import { PublishPushDeliveryOutboxUseCase } from "./application/use-cases/publish-push-delivery-outbox.use-case.js";
import { ReconcilePushReceiptsUseCase } from "./application/use-cases/reconcile-push-receipts.use-case.js";
import { RecoverFailedPushDeliveriesUseCase } from "./application/use-cases/recover-failed-push-deliveries.use-case.js";
import { RelayPushDeliveryOutboxUseCase } from "./application/use-cases/relay-push-delivery-outbox.use-case.js";
import { CachedNotificationRecipientPreferenceAdapter } from "./infrastructure/adapters/cached-notification-recipient-preference.adapter.js";
import { ExpoPushSenderAdapter } from "./infrastructure/adapters/expo-push-sender.adapter.js";
import { HmacMarketingPushOptOutTokenAdapter } from "./infrastructure/adapters/hmac-marketing-push-opt-out-token.adapter.js";
import { PushNotificationPayloadMapper } from "./infrastructure/adapters/push-notification-payload.mapper.js";
import { selectPushRateLimiter } from "./infrastructure/adapters/push-rate-limiter-factory.adapter.js";
import { PushDeliveryQueueAdapter } from "./infrastructure/jobs/push-delivery-queue.adapter.js";
import { DrizzlePushCampaignOutcomeReader } from "./infrastructure/persistence/drizzle-push-campaign-outcome.reader.js";
import { DrizzlePushDeliveryClaimRepository } from "./infrastructure/persistence/drizzle-push-delivery-claim.repository.js";
import { DrizzlePushDeliveryFinalizationRepository } from "./infrastructure/persistence/drizzle-push-delivery-finalization.repository.js";
import { DrizzlePushDeliveryLeaseRepository } from "./infrastructure/persistence/drizzle-push-delivery-lease.repository.js";
import { DrizzlePushDeliveryOutboxRepository } from "./infrastructure/persistence/drizzle-push-delivery-outbox.repository.js";
import { DrizzlePushDispatchRepository } from "./infrastructure/persistence/drizzle-push-dispatch.repository.js";
import { DrizzlePushReceiptRepository } from "./infrastructure/persistence/drizzle-push-receipt.repository.js";
import { notificationPushDispatchesConfig } from "./notification-push-dispatches.config.js";

// 운영은 PostgreSQL, 설정으로 Redis·메모리를 고른다
const pushRateLimiterProvider = {
  provide: PushRateLimiterPort,
  useFactory: (
    config: ConfigType<typeof notificationPushDispatchesConfig>,
    database: Database,
    clock: ClockPort,
    redis?: Redis,
  ): PushRateLimiterPort =>
    selectPushRateLimiter(config.rateLimitBackend, {
      database,
      clock,
      ...(redis && { redis }),
    }),
  inject: [
    notificationPushDispatchesConfig.KEY,
    DRIZZLE,
    ClockPort,
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

const NOTIFICATION_PUSH_DISPATCHES_EXTERNAL_PROVIDERS = [
  { provide: PushProviderPort, useClass: ExpoPushSenderAdapter },
  pushRateLimiterProvider,
  { provide: MarketingPushOptOutTokenPort, useClass: HmacMarketingPushOptOutTokenAdapter },
] satisfies Provider[];

export const NOTIFICATION_PUSH_DISPATCHES_USE_CASE_PROVIDERS = [
  provideUseCase(PushQuietHoursReader, { userSettings: UserNotificationSettingsPort }),
  { provide: PushQuietHoursReaderPort, useExisting: PushQuietHoursReader },
  {
    provide: PushNotificationPayloadPort,
    useFactory: (marketingOptOutTokens: MarketingPushOptOutTokenPort) =>
      new PushNotificationPayloadMapper({ marketingOptOutTokens }),
    inject: [MarketingPushOptOutTokenPort],
  },
  provideUseCase(EvaluatePushDeliveryEligibilityUseCase, {
    userSettings: UserNotificationSettingsPort,
    rateLimiter: PushRateLimiterPort,
    recipientPreferenceReader: NotificationRecipientPreferenceReaderPort,
    clock: ClockPort,
  }),
  provideUseCase(DispatchPushNotificationUseCase, {
    pushTokenRepository: PushTokenRepositoryPort,
    pushDeviceRepository: PushDeviceRepositoryPort,
    pushProvider: PushProviderPort,
    activePushTokenReader: ActivePushTokenReaderPort,
    pushTokenCache: PushTokenCachePort,
    clock: ClockPort,
    logger: loggerFor(DispatchPushNotificationUseCase),
  }),
  provideUseCase(DeliverPushNotificationsUseCase, {
    claims: PushDeliveryClaimRepositoryPort,
    finalization: PushDeliveryFinalizationRepositoryPort,
    lease: PushDeliveryLeaseRepositoryPort,
    unitOfWork: UnitOfWorkPort,
    eligibility: EvaluatePushDeliveryEligibilityUseCase,
    payloadFactory: PushNotificationPayloadPort,
    delivery: DispatchPushNotificationUseCase,
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
    pushProvider: PushProviderPort,
    clock: ClockPort,
  }),
  provideUseCase(ReconcilePushReceiptsUseCase, {
    pushReceiptRepository: PushReceiptRepositoryPort,
    pushTokenRepository: PushTokenRepositoryPort,
    pushProvider: PushProviderPort,
    cache: PushTokenCachePort,
    unitOfWork: UnitOfWorkPort,
    clock: ClockPort,
    logger: loggerFor(ReconcilePushReceiptsUseCase),
    alert: OperationalAlertPort,
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
