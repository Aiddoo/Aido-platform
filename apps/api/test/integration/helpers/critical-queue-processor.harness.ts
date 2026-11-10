import { ClsPluginTransactional, TransactionHost } from "@nestjs-cls/transactional";
import { TransactionalAdapterDrizzleOrm } from "@nestjs-cls/transactional-adapter-drizzle-orm";
import { type DynamicModule, Module, type Provider } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { ClsModule } from "nestjs-cls";
import { PgBoss } from "pg-boss";

import type {
  UserConsentRecord,
  UserConsentRecordWithId,
  UserPreferenceRecord,
  UserPreferenceRecordWithId,
} from "#api/modules/identity/identity-settings.public";
import {
  USER_PREFERENCE_READER,
  USER_SETTINGS_CACHE,
} from "#api/modules/identity/identity-settings.public";
import { ReadUserPreferencesUseCase } from "#api/modules/identity/preferences/application/use-cases/read-user-preferences.use-case";
import { UserSettingsCacheAdapter } from "#api/modules/identity/preferences/infrastructure/adapters/user-settings-cache.adapter";
import { DrizzleUserPreferenceRepository } from "#api/modules/identity/preferences/infrastructure/persistence/drizzle-user-preference.repository";
import {
  RETENTION_CONFIG,
  type RetentionConfigPort,
} from "#api/modules/notification/application/ports/retention/retention-config.port";
import { RETENTION_REPOSITORY } from "#api/modules/notification/application/ports/retention/retention.repository.port";
import { NOTIFICATION_CACHE } from "#api/modules/notification/inbox/application/ports/notification-cache.port";
import { NOTIFICATION_HISTORY_READER } from "#api/modules/notification/inbox/application/ports/notification-history.reader.port";
import { NOTIFICATION_INBOX_READER } from "#api/modules/notification/inbox/application/ports/notification-inbox.reader.port";
import { NOTIFICATION_REPOSITORY } from "#api/modules/notification/inbox/application/ports/notification.repository.port";
import { GetNotifications } from "#api/modules/notification/inbox/application/use-cases/get-notifications.use-case";
import { GetUnreadCount } from "#api/modules/notification/inbox/application/use-cases/get-unread-count.use-case";
import { MarkAllAsRead } from "#api/modules/notification/inbox/application/use-cases/mark-all-as-read.use-case";
import { MarkAsRead } from "#api/modules/notification/inbox/application/use-cases/mark-as-read.use-case";
import { MarkNotificationOpened } from "#api/modules/notification/inbox/application/use-cases/mark-notification-opened.use-case";
import { NotificationCacheAdapter } from "#api/modules/notification/inbox/infrastructure/cache/notification-cache.adapter";
import { DrizzleNotificationReader } from "#api/modules/notification/inbox/infrastructure/persistence/drizzle-notification.reader";
import { DrizzleNotificationRepository } from "#api/modules/notification/inbox/infrastructure/persistence/drizzle-notification.repository";
import { RetentionQueueProcessor } from "#api/modules/notification/infrastructure/jobs/retention/retention-queue.processor";
import { DrizzleRetentionRepository } from "#api/modules/notification/infrastructure/persistence/retention/drizzle-retention.repository";
import { processRetentionStagesProvider } from "#api/modules/notification/notification-retention-application.providers";
import { ACTIVE_PUSH_TOKEN_READER } from "#api/modules/notification/push/application/ports/active-push-token.reader.port";
import { MARKETING_PUSH_OPT_OUT_TOKEN } from "#api/modules/notification/push/application/ports/marketing-push-opt-out-token.port";
import { NOTIFICATION_DEDUP } from "#api/modules/notification/push/application/ports/notification-dedup.port";
import { NOTIFICATION_RECIPIENT_LOCALE_READER } from "#api/modules/notification/push/application/ports/notification-recipient-locale.reader.port";
import { NOTIFICATION_RECIPIENT_PREFERENCE_READER } from "#api/modules/notification/push/application/ports/notification-recipient-preference.reader.port";
import { NOTIFICATION_RECIPIENT_TIMEZONE_READER } from "#api/modules/notification/push/application/ports/notification-recipient-timezone.reader.port";
import { NOTIFICATION_TODO_TARGET_READER } from "#api/modules/notification/push/application/ports/notification-todo-target.reader.port";
import { PUSH_DELIVERY_JOB_ENQUEUER } from "#api/modules/notification/push/application/ports/push-delivery-job-enqueuer.port";
import { PUSH_DELIVERY_LIFECYCLE_REPOSITORY } from "#api/modules/notification/push/application/ports/push-delivery-lifecycle.repository.port";
import { PUSH_DELIVERY_OUTBOX_REPOSITORY } from "#api/modules/notification/push/application/ports/push-delivery-outbox.repository.port";
import { PUSH_DEVICE_REPOSITORY } from "#api/modules/notification/push/application/ports/push-device.repository.port";
import { PUSH_DISPATCH_STAGING } from "#api/modules/notification/push/application/ports/push-dispatch-staging.repository.port";
import { PUSH_PROVIDER } from "#api/modules/notification/push/application/ports/push-provider.port";
import { PUSH_RATE_LIMITER } from "#api/modules/notification/push/application/ports/push-rate-limiter.port";
import { PUSH_RECEIPT_REPOSITORY } from "#api/modules/notification/push/application/ports/push-receipt.repository.port";
import { PUSH_TOKEN_REPOSITORY } from "#api/modules/notification/push/application/ports/push-token.repository.port";
import {
  USER_NOTIFICATION_SETTINGS,
  type UserNotificationSettingsPort,
} from "#api/modules/notification/push/application/ports/user-notification-settings.port";
import { OptOutMarketingPush } from "#api/modules/notification/push/application/use-cases/opt-out-marketing-push.use-case";
import { ReconcilePushReceipts } from "#api/modules/notification/push/application/use-cases/reconcile-push-receipts.use-case";
import { ReportPushDevice } from "#api/modules/notification/push/application/use-cases/report-push-device.use-case";
import { SendBillingIssueNotification } from "#api/modules/notification/push/application/use-cases/send-billing-issue-notification.use-case";
import { SendCheerNotification } from "#api/modules/notification/push/application/use-cases/send-cheer-notification.use-case";
import { SendFollowAcceptedNotification } from "#api/modules/notification/push/application/use-cases/send-follow-accepted-notification.use-case";
import { SendFollowRequestNotification } from "#api/modules/notification/push/application/use-cases/send-follow-request-notification.use-case";
import { SendMilestoneNotification } from "#api/modules/notification/push/application/use-cases/send-milestone-notification.use-case";
import { SendNotificationWithDedup } from "#api/modules/notification/push/application/use-cases/send-notification-with-dedup.use-case";
import { SendNudgeNotification } from "#api/modules/notification/push/application/use-cases/send-nudge-notification.use-case";
import { UnregisterPushDevice } from "#api/modules/notification/push/application/use-cases/unregister-push-device.use-case";
import { CachedActivePushTokenReaderAdapter } from "#api/modules/notification/push/infrastructure/adapters/cached-active-push-token-reader.adapter";
import { CachedNotificationRecipientPreferenceAdapter } from "#api/modules/notification/push/infrastructure/adapters/cached-notification-recipient-preference.adapter";
import { InMemoryPushRateLimiter } from "#api/modules/notification/push/infrastructure/adapters/in-memory-push-rate-limiter.adapter";
import { NotificationDedupAdapter } from "#api/modules/notification/push/infrastructure/adapters/notification-dedup.adapter";
import { NotificationQueueProcessor } from "#api/modules/notification/push/infrastructure/jobs/notification-queue.processor";
import { PushDeliveryQueueService } from "#api/modules/notification/push/infrastructure/jobs/push-delivery-queue.adapter";
import { PushDeliveryQueueProcessor } from "#api/modules/notification/push/infrastructure/jobs/push-delivery-queue.processor";
import { DrizzleNotificationTodoTargetReader } from "#api/modules/notification/push/infrastructure/persistence/drizzle-notification-todo-target.reader";
import { DrizzlePushDeliveryLifecycleRepository } from "#api/modules/notification/push/infrastructure/persistence/drizzle-push-delivery-lifecycle.repository";
import { DrizzlePushDeliveryOutboxRepository } from "#api/modules/notification/push/infrastructure/persistence/drizzle-push-delivery-outbox.repository";
import { DrizzlePushDeviceRepository } from "#api/modules/notification/push/infrastructure/persistence/drizzle-push-device.repository";
import { DrizzlePushDispatchStagingRepository } from "#api/modules/notification/push/infrastructure/persistence/drizzle-push-dispatch-staging.repository";
import { DrizzlePushReceiptRepository } from "#api/modules/notification/push/infrastructure/persistence/drizzle-push-receipt.repository";
import { DrizzlePushTokenRepository } from "#api/modules/notification/push/infrastructure/persistence/drizzle-push-token.repository";
import {
  deliverPushNotificationsProvider,
  finalizeBatchNotificationProvider,
  notificationPublisherProvider,
  notificationHistoryReaderProvider,
  persistBatchNotificationProvider,
  publishPushDeliveryOutboxProvider,
  pushDeliveryAfterCommitPublisherProvider,
  pushDeliveryEligibilityServiceProvider,
  pushNotificationDeliveryServiceProvider,
  pushNotificationPayloadFactoryProvider,
  recoverFailedPushDeliveriesProvider,
  relayPushDeliveryOutboxProvider,
  sendBatchNotificationProvider,
  sendFriendCompletionNotificationsProvider,
  sendNotificationProvider,
} from "#api/modules/notification/push/notification-push.providers";
import { AdminBroadcastNotifierPort } from "#api/modules/operations/broadcasts/application/ports/admin-broadcast-notifier.port";
import { AdminUserDirectoryReaderPort } from "#api/modules/operations/broadcasts/application/ports/admin-user-directory.reader.port";
import { BroadcastCampaignRepositoryPort } from "#api/modules/operations/broadcasts/application/ports/broadcast-campaign.repository.port";
import { BroadcastJobEnqueuerPort } from "#api/modules/operations/broadcasts/application/ports/broadcast-job-enqueuer.port";
import { BroadcastRecipientReaderPort } from "#api/modules/operations/broadcasts/application/ports/broadcast-recipient.reader.port";
import { CreateBroadcastCampaignUseCase } from "#api/modules/operations/broadcasts/application/use-cases/create-broadcast-campaign.use-case";
import { DeliverBroadcastGroupUseCase } from "#api/modules/operations/broadcasts/application/use-cases/deliver-broadcast-group.use-case";
import { FailBroadcastCampaignUseCase } from "#api/modules/operations/broadcasts/application/use-cases/fail-broadcast-campaign.use-case";
import { FanOutBroadcastCampaignUseCase } from "#api/modules/operations/broadcasts/application/use-cases/fan-out-broadcast-campaign.use-case";
import { ReportBroadcastDeliveryExhaustedUseCase } from "#api/modules/operations/broadcasts/application/use-cases/report-broadcast-delivery-exhausted.use-case";
import { BroadcastJobEnqueuerAdapter } from "#api/modules/operations/broadcasts/infrastructure/adapters/broadcast-job-enqueuer.adapter";
import { NotificationAdminBroadcastNotifierAdapter } from "#api/modules/operations/broadcasts/infrastructure/adapters/notification-admin-broadcast-notifier.adapter";
import { NotificationBroadcastRecipientAdapter } from "#api/modules/operations/broadcasts/infrastructure/adapters/notification-broadcast-recipient.adapter";
import { BroadcastDeliveryProcessor } from "#api/modules/operations/broadcasts/infrastructure/jobs/broadcast-delivery.processor";
import { BroadcastFanOutProcessor } from "#api/modules/operations/broadcasts/infrastructure/jobs/broadcast-fan-out.processor";
import { DrizzleAdminUserDirectoryReader } from "#api/modules/operations/broadcasts/infrastructure/persistence/drizzle-admin-user-directory.reader";
import { DrizzleBroadcastCampaignRepository } from "#api/modules/operations/broadcasts/infrastructure/persistence/drizzle-broadcast-campaign.repository";
import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import { CacheService } from "#api/platform/cache/cache.service";
import { ClsUnitOfWork } from "#api/platform/database/cls-unit-of-work";
import {
  type Database,
  DRIZZLE,
  type DrizzleTransactionalAdapter,
} from "#api/platform/database/database.client";
import { userConsent, userPreference } from "#api/platform/database/schema/index";
import { InMemoryDedupAdapter } from "#api/platform/dedup/adapters/in-memory-dedup.adapter";
import { DEDUP_PROVIDER } from "#api/platform/dedup/interfaces/dedup.interface";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { JobQueueRegistry } from "#api/platform/jobs/job-queue.registry";
import { PgBossJobQueueAdapter } from "#api/platform/jobs/pg-boss-job-queue.adapter";
import { PgBossJobRuntimeAdapter } from "#api/platform/jobs/pg-boss-job-runtime.adapter";
import { SystemClock } from "#api/platform/time/system-clock";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import {
  AFTER_COMMIT_TASK_REGISTRY,
  JOB_RUNTIME,
  JobQueuePort,
  type JobRuntimePort,
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import { FakePushProvider } from "#test/mocks/fake-push.provider";
import { suppressLogger } from "#test/setup/suppress-logger";
import type { TestDatabaseClient } from "#test/setup/test-database";
import { TestDatabase } from "#test/setup/test-database";

const PG_BOSS_SCHEMA = "pgboss_critical_processors";
const POLL_INTERVAL_MS = 100;
const EVENTUALLY_TIMEOUT_MS = 20_000;

const unexpectedUseCase = {
  execute: async () => {
    throw new Error("Unexpected use-case execution in critical queue harness");
  },
};

@Module({})
class CriticalQueueDatabaseModule {
  static register(client: TestDatabaseClient): DynamicModule {
    return {
      module: CriticalQueueDatabaseModule,
      providers: [{ provide: DRIZZLE, useValue: client }],
      exports: [DRIZZLE],
    };
  }
}

export interface CriticalQueueProcessorHarness {
  readonly client: TestDatabaseClient;
  readonly boss: PgBoss;
  readonly runtime: JobRuntimePort;
  readonly pushProvider: FakePushProvider;
  readonly module: TestingModule;
  readonly retentionRepository: DrizzleRetentionRepository;
  readonly daytimeTimezone: string;
  cleanup(): Promise<void>;
  eventually(assertion: () => Promise<void>, timeoutMs?: number): Promise<void>;
  close(): Promise<void>;
}

export async function createCriticalQueueProcessorHarness(): Promise<CriticalQueueProcessorHarness> {
  suppressLogger();
  const testDatabase = new TestDatabase();
  const client = await testDatabase.start();
  const connectionString = testDatabase.getConnectionUri();
  const daytimeTimezone = findDaytimeTimezone(new Date());

  const migrator = new PgBoss({
    connectionString,
    schema: PG_BOSS_SCHEMA,
    migrate: true,
    createSchema: true,
    useListenNotify: false,
  });
  await migrator.start();
  await migrator.stop({ graceful: true, timeout: 10_000, close: true });

  const boss = new PgBoss({
    connectionString,
    schema: PG_BOSS_SCHEMA,
    migrate: false,
    createSchema: false,
    max: 5,
    useListenNotify: false,
  });
  const pushProvider = new FakePushProvider();
  const databaseModule = CriticalQueueDatabaseModule.register(client);
  const module = await Test.createTestingModule({
    imports: [
      databaseModule,
      ClsModule.forRoot({
        global: true,
        plugins: [
          new ClsPluginTransactional({
            imports: [databaseModule],
            adapter: new TransactionalAdapterDrizzleOrm({ drizzleInstanceToken: DRIZZLE }),
          }),
        ],
      }),
    ],
    providers: [
      ClsUnitOfWork,
      { provide: UNIT_OF_WORK, useExisting: ClsUnitOfWork },
      { provide: UnitOfWorkPort, useExisting: ClsUnitOfWork },
      { provide: AFTER_COMMIT_TASK_REGISTRY, useExisting: ClsUnitOfWork },
      {
        provide: JOB_RUNTIME,
        inject: [TransactionHost],
        useFactory: (txHost: TransactionHost<DrizzleTransactionalAdapter>) =>
          new PgBossJobRuntimeAdapter(boss, txHost, {
            job: { shutdownTimeoutMs: 10_000 },
          }),
      },
      JobQueueRegistry,
      {
        provide: JobQueuePort,
        inject: [TransactionHost, JobQueueRegistry],
        useFactory: (
          txHost: TransactionHost<DrizzleTransactionalAdapter>,
          registry: JobQueueRegistry,
        ) => new PgBossJobQueueAdapter(boss, txHost, registry),
      },
      ...notificationProviders(pushProvider),
      ...retentionProviders(),
      ...broadcastProviders(),
    ],
  }).compile();

  const runtime = module.get<JobRuntimePort>(JOB_RUNTIME);
  await runtime.start();
  await module.init();

  return {
    client,
    boss,
    runtime,
    pushProvider,
    module,
    retentionRepository: module.get(DrizzleRetentionRepository),
    daytimeTimezone,
    cleanup: async () => {
      await testDatabase.cleanup();
      pushProvider.clear();
      await module.get(CacheService).reset();
    },
    eventually: async (assertion, timeoutMs) => {
      await eventually(assertion, timeoutMs);
    },
    close: async () => {
      await runtime.stop();
      await module.close();
      await testDatabase.stop();
    },
  };
}

function notificationProviders(pushProvider: FakePushProvider): Provider[] {
  return [
    NotificationQueueProcessor,
    sendFriendCompletionNotificationsProvider,
    { provide: SendFollowRequestNotification, useValue: unexpectedUseCase },
    { provide: SendFollowAcceptedNotification, useValue: unexpectedUseCase },
    { provide: SendNudgeNotification, useValue: unexpectedUseCase },
    { provide: SendCheerNotification, useValue: unexpectedUseCase },
    { provide: SendBillingIssueNotification, useValue: unexpectedUseCase },
    { provide: SendMilestoneNotification, useValue: unexpectedUseCase },
    { provide: ReconcilePushReceipts, useValue: unexpectedUseCase },
    notificationPublisherProvider,
    notificationHistoryReaderProvider,
    persistBatchNotificationProvider,
    finalizeBatchNotificationProvider,
    {
      provide: GetNotifications,
      useValue: unexpectedUseCase,
    },
    { provide: GetUnreadCount, useValue: unexpectedUseCase },
    { provide: MarkAsRead, useValue: unexpectedUseCase },
    { provide: MarkNotificationOpened, useValue: unexpectedUseCase },
    { provide: MarkAllAsRead, useValue: unexpectedUseCase },
    { provide: ReportPushDevice, useValue: unexpectedUseCase },
    { provide: UnregisterPushDevice, useValue: unexpectedUseCase },
    { provide: OptOutMarketingPush, useValue: unexpectedUseCase },
    sendNotificationProvider,
    { provide: SendNotificationWithDedup, useValue: unexpectedUseCase },
    sendBatchNotificationProvider,
    DrizzleNotificationRepository,
    { provide: NOTIFICATION_REPOSITORY, useExisting: DrizzleNotificationRepository },
    DrizzleNotificationReader,
    { provide: NOTIFICATION_INBOX_READER, useExisting: DrizzleNotificationReader },
    { provide: NOTIFICATION_HISTORY_READER, useExisting: DrizzleNotificationReader },
    DrizzleNotificationTodoTargetReader,
    { provide: NOTIFICATION_TODO_TARGET_READER, useExisting: DrizzleNotificationTodoTargetReader },
    DrizzlePushDeviceRepository,
    { provide: PUSH_DEVICE_REPOSITORY, useExisting: DrizzlePushDeviceRepository },
    DrizzlePushTokenRepository,
    { provide: PUSH_TOKEN_REPOSITORY, useExisting: DrizzlePushTokenRepository },
    DrizzlePushReceiptRepository,
    { provide: PUSH_RECEIPT_REPOSITORY, useExisting: DrizzlePushReceiptRepository },
    DrizzlePushDispatchStagingRepository,
    { provide: PUSH_DISPATCH_STAGING, useExisting: DrizzlePushDispatchStagingRepository },
    DrizzlePushDeliveryOutboxRepository,
    {
      provide: PUSH_DELIVERY_OUTBOX_REPOSITORY,
      useExisting: DrizzlePushDeliveryOutboxRepository,
    },
    DrizzlePushDeliveryLifecycleRepository,
    {
      provide: PUSH_DELIVERY_LIFECYCLE_REPOSITORY,
      useExisting: DrizzlePushDeliveryLifecycleRepository,
    },
    { provide: PUSH_PROVIDER, useValue: pushProvider },
    { provide: PUSH_RATE_LIMITER, useClass: InMemoryPushRateLimiter },
    {
      provide: MARKETING_PUSH_OPT_OUT_TOKEN,
      useValue: {
        issue: (userId: string) => `fake-opt-out:${userId}`,
        verify: (token: string) =>
          token.startsWith("fake-opt-out:") ? token.slice("fake-opt-out:".length) : null,
      },
    },
    {
      provide: CacheStorePort,
      useFactory: () =>
        new InMemoryCacheStore({
          defaultTtlMs: 60_000,
          maxItems: 100,
        }),
    },
    CacheService,
    UserSettingsCacheAdapter,
    { provide: USER_SETTINGS_CACHE, useExisting: UserSettingsCacheAdapter },
    NotificationCacheAdapter,
    { provide: NOTIFICATION_CACHE, useExisting: NotificationCacheAdapter },
    InMemoryDedupAdapter,
    { provide: DEDUP_PROVIDER, useExisting: InMemoryDedupAdapter },
    NotificationDedupAdapter,
    { provide: NOTIFICATION_DEDUP, useExisting: NotificationDedupAdapter },
    {
      provide: USER_NOTIFICATION_SETTINGS,
      inject: [DRIZZLE],
      useFactory: (database: Database): UserNotificationSettingsPort =>
        createDatabaseBackedSettingsPort(database),
    },
    CachedActivePushTokenReaderAdapter,
    { provide: ACTIVE_PUSH_TOKEN_READER, useExisting: CachedActivePushTokenReaderAdapter },
    DrizzleUserPreferenceRepository,
    {
      provide: USER_PREFERENCE_READER,
      useFactory: (preferenceRepository: DrizzleUserPreferenceRepository, cache: CacheService) =>
        new ReadUserPreferencesUseCase({
          preferenceRepository,
          cache: new UserSettingsCacheAdapter(cache),
        }),
      inject: [DrizzleUserPreferenceRepository, CacheService],
    },
    CachedNotificationRecipientPreferenceAdapter,
    {
      provide: NOTIFICATION_RECIPIENT_PREFERENCE_READER,
      useExisting: CachedNotificationRecipientPreferenceAdapter,
    },
    {
      provide: NOTIFICATION_RECIPIENT_LOCALE_READER,
      useExisting: CachedNotificationRecipientPreferenceAdapter,
    },
    {
      provide: NOTIFICATION_RECIPIENT_TIMEZONE_READER,
      useExisting: CachedNotificationRecipientPreferenceAdapter,
    },
    pushDeliveryEligibilityServiceProvider,
    pushDeliveryAfterCommitPublisherProvider,
    pushNotificationDeliveryServiceProvider,
    pushNotificationPayloadFactoryProvider,
    deliverPushNotificationsProvider,
    publishPushDeliveryOutboxProvider,
    recoverFailedPushDeliveriesProvider,
    relayPushDeliveryOutboxProvider,
    PushDeliveryQueueService,
    { provide: PUSH_DELIVERY_JOB_ENQUEUER, useExisting: PushDeliveryQueueService },
    PushDeliveryQueueProcessor,
  ];
}

function retentionProviders(): Provider[] {
  const config: RetentionConfigPort = {
    enabled: true,
    treatmentPercent: 100,
  };
  return [
    RetentionQueueProcessor,
    processRetentionStagesProvider,
    DrizzleRetentionRepository,
    { provide: RETENTION_REPOSITORY, useExisting: DrizzleRetentionRepository },
    { provide: RETENTION_CONFIG, useValue: config },
  ];
}

function broadcastProviders(): Provider[] {
  return [
    { provide: ClockPort, useClass: SystemClock },
    { provide: OperationalAlertPort, useValue: new RecordingOperationalAlert() },
    { provide: BroadcastCampaignRepositoryPort, useClass: DrizzleBroadcastCampaignRepository },
    { provide: BroadcastJobEnqueuerPort, useClass: BroadcastJobEnqueuerAdapter },
    { provide: AdminUserDirectoryReaderPort, useClass: DrizzleAdminUserDirectoryReader },
    { provide: AdminBroadcastNotifierPort, useClass: NotificationAdminBroadcastNotifierAdapter },
    { provide: BroadcastRecipientReaderPort, useClass: NotificationBroadcastRecipientAdapter },
    provideUseCase(CreateBroadcastCampaignUseCase, {
      unitOfWork: UnitOfWorkPort,
      campaignRepository: BroadcastCampaignRepositoryPort,
      userDirectory: AdminUserDirectoryReaderPort,
      jobEnqueuer: BroadcastJobEnqueuerPort,
      clock: ClockPort,
      logger: loggerFor(CreateBroadcastCampaignUseCase),
    }),
    provideUseCase(FanOutBroadcastCampaignUseCase, {
      unitOfWork: UnitOfWorkPort,
      campaignRepository: BroadcastCampaignRepositoryPort,
      userDirectory: AdminUserDirectoryReaderPort,
      recipientReader: BroadcastRecipientReaderPort,
      notifier: AdminBroadcastNotifierPort,
      jobEnqueuer: BroadcastJobEnqueuerPort,
      clock: ClockPort,
      logger: loggerFor(FanOutBroadcastCampaignUseCase),
    }),
    provideUseCase(DeliverBroadcastGroupUseCase, {
      unitOfWork: UnitOfWorkPort,
      campaignRepository: BroadcastCampaignRepositoryPort,
      recipientReader: BroadcastRecipientReaderPort,
      notifier: AdminBroadcastNotifierPort,
      logger: loggerFor(DeliverBroadcastGroupUseCase),
    }),
    provideUseCase(FailBroadcastCampaignUseCase, {
      unitOfWork: UnitOfWorkPort,
      campaignRepository: BroadcastCampaignRepositoryPort,
      clock: ClockPort,
      logger: loggerFor(FailBroadcastCampaignUseCase),
    }),
    provideUseCase(ReportBroadcastDeliveryExhaustedUseCase, { alert: OperationalAlertPort }),
    BroadcastFanOutProcessor,
    BroadcastDeliveryProcessor,
  ];
}

function createDatabaseBackedSettingsPort(database: Database): UserNotificationSettingsPort {
  const upsertPreference = async (
    userId: string,
    values: Partial<Pick<typeof userPreference.$inferInsert, "timezone" | "locale">>,
  ): Promise<void> => {
    await database
      .insert(userPreference)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: userPreference.userId, set: { userId, ...values } });
  };
  return {
    upsertPushTimezone: (userId, timezone) => upsertPreference(userId, { timezone }),
    upsertPushLocale: (userId, locale) => upsertPreference(userId, { locale }),
    getPreferenceRecord: async (userId): Promise<UserPreferenceRecord | null> =>
      (await database.query.userPreference.findFirst({ where: { userId } })) ?? null,
    getPreferenceRecordsByUserIds: async (userIds): Promise<UserPreferenceRecordWithId[]> =>
      userIds.length === 0
        ? []
        : database.query.userPreference.findMany({ where: { userId: { in: [...userIds] } } }),
    getConsentRecord: async (userId): Promise<UserConsentRecord | null> =>
      (await database.query.userConsent.findFirst({ where: { userId } })) ?? null,
    getConsentRecordsByUserIds: async (userIds): Promise<UserConsentRecordWithId[]> =>
      userIds.length === 0
        ? []
        : database.query.userConsent.findMany({ where: { userId: { in: [...userIds] } } }),
    updateMarketingPushConsent: async (userId, agreed) => {
      const marketingPushAgreedAt = agreed ? new Date() : null;
      await database
        .insert(userConsent)
        .values({ userId, marketingPushAgreedAt })
        .onConflictDoUpdate({
          target: userConsent.userId,
          set: { marketingPushAgreedAt },
        });
    },
  };
}

async function eventually(
  assertion: () => Promise<void>,
  timeoutMs = EVENTUALLY_TIMEOUT_MS,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
  throw lastError;
}

function findDaytimeTimezone(now: Date): string {
  const candidates = [
    "Pacific/Pago_Pago",
    "Pacific/Honolulu",
    "America/Anchorage",
    "America/Los_Angeles",
    "America/Denver",
    "America/Chicago",
    "America/New_York",
    "America/Halifax",
    "America/Sao_Paulo",
    "Atlantic/South_Georgia",
    "Atlantic/Azores",
    "Europe/London",
    "Europe/Paris",
    "Europe/Helsinki",
    "Asia/Dubai",
    "Asia/Karachi",
    "Asia/Dhaka",
    "Asia/Bangkok",
    "Asia/Shanghai",
    "Asia/Seoul",
    "Australia/Brisbane",
    "Pacific/Noumea",
    "Pacific/Auckland",
    "Pacific/Apia",
    "Pacific/Kiritimati",
  ];
  for (const timezone of candidates) {
    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(now)
        .find((part) => part.type === "hour")?.value ?? "0",
    );
    if (hour >= 9 && hour < 20) {
      return timezone;
    }
  }
  throw new Error("No daytime IANA timezone available for retention test");
}
