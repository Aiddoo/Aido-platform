import { ClsPluginTransactional, TransactionHost } from "@nestjs-cls/transactional";
import { type DynamicModule, Module, type Provider } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ClsModule } from "nestjs-cls";
import { PgBoss } from "pg-boss";

import { UserPreferenceReader } from "#api/modules/identity/application/services/settings/user-preference-reader.service";
import type {
  UserConsentRecord,
  UserConsentRecordWithId,
  UserPreferenceRecord,
  UserPreferenceRecordWithId,
} from "#api/modules/identity/identity-settings.public";
import { USER_PREFERENCE_READER } from "#api/modules/identity/identity-settings.public";
import { UserSettingsCacheAdapter } from "#api/modules/identity/infrastructure/adapters/settings/user-settings-cache.adapter";
import { UserPreferenceRepository } from "#api/modules/identity/infrastructure/persistence/settings/user-preference.repository";
import { ACTIVE_PUSH_TOKEN_READER } from "#api/modules/notification/application/ports/delivery/active-push-token.reader.port";
import { NOTIFICATION_CACHE } from "#api/modules/notification/application/ports/delivery/notification-cache.port";
import { NOTIFICATION_DEDUP } from "#api/modules/notification/application/ports/delivery/notification-dedup.port";
import { NOTIFICATION_HISTORY_READER } from "#api/modules/notification/application/ports/delivery/notification-history.reader.port";
import { NOTIFICATION_INBOX_READER } from "#api/modules/notification/application/ports/delivery/notification-inbox.reader.port";
import {
  NOTIFICATION_RECIPIENT_LOCALE_READER,
  type NotificationRecipientLocaleReaderPort,
} from "#api/modules/notification/application/ports/delivery/notification-recipient-locale.reader.port";
import { NOTIFICATION_RECIPIENT_PREFERENCE_READER } from "#api/modules/notification/application/ports/delivery/notification-recipient-preference.reader.port";
import { NOTIFICATION_REPOSITORY } from "#api/modules/notification/application/ports/delivery/notification.repository.port";
import { PUSH_DELIVERY_JOB_ENQUEUER } from "#api/modules/notification/application/ports/delivery/push-delivery-job-enqueuer.port";
import { PUSH_DELIVERY_LIFECYCLE_REPOSITORY } from "#api/modules/notification/application/ports/delivery/push-delivery-lifecycle.repository.port";
import { PUSH_DELIVERY_OUTBOX_REPOSITORY } from "#api/modules/notification/application/ports/delivery/push-delivery-outbox.repository.port";
import { PUSH_DISPATCH_STAGING } from "#api/modules/notification/application/ports/delivery/push-dispatch-staging.repository.port";
import { PUSH_RECEIPT_REPOSITORY } from "#api/modules/notification/application/ports/delivery/push-receipt.repository.port";
import { PUSH_TOKEN_REPOSITORY } from "#api/modules/notification/application/ports/delivery/push-token.repository.port";
import {
  USER_NOTIFICATION_SETTINGS,
  type UserNotificationSettingsPort,
} from "#api/modules/notification/application/ports/delivery/user-notification-settings.port";
import {
  RETENTION_CONFIG,
  type RetentionConfigPort,
} from "#api/modules/notification/application/ports/retention/retention-config.port";
import { RETENTION_PUSH_SENDER } from "#api/modules/notification/application/ports/retention/retention-push-sender.port";
import { RETENTION_REPOSITORY } from "#api/modules/notification/application/ports/retention/retention.repository.port";
import { NotificationPublisher } from "#api/modules/notification/application/publishers/delivery/notification.publisher";
import { NotificationHistoryReader } from "#api/modules/notification/application/readers/delivery/notification-history.reader";
import { NotificationRecipientLocaleReader } from "#api/modules/notification/application/readers/delivery/notification-recipient-locale.reader";
import { FindAlreadyNotifiedUsers } from "#api/modules/notification/application/use-cases/delivery/find-already-notified-users.use-case";
import { GetNotifications } from "#api/modules/notification/application/use-cases/delivery/get-notifications.use-case";
import { GetUnreadCount } from "#api/modules/notification/application/use-cases/delivery/get-unread-count.use-case";
import { MarkAllAsRead } from "#api/modules/notification/application/use-cases/delivery/mark-all-as-read.use-case";
import { MarkAsRead } from "#api/modules/notification/application/use-cases/delivery/mark-as-read.use-case";
import { MarkNotificationOpened } from "#api/modules/notification/application/use-cases/delivery/mark-notification-opened.use-case";
import { OptOutMarketingPush } from "#api/modules/notification/application/use-cases/delivery/opt-out-marketing-push.use-case";
import { ReconcilePushReceipts } from "#api/modules/notification/application/use-cases/delivery/reconcile-push-receipts.use-case";
import { RegisterPushToken } from "#api/modules/notification/application/use-cases/delivery/register-push-token.use-case";
import { SendBatchNotification } from "#api/modules/notification/application/use-cases/delivery/send-batch-notification.use-case";
import { SendBillingIssueNotification } from "#api/modules/notification/application/use-cases/delivery/send-billing-issue-notification.use-case";
import { SendCheerNotification } from "#api/modules/notification/application/use-cases/delivery/send-cheer-notification.use-case";
import { SendFollowAcceptedNotification } from "#api/modules/notification/application/use-cases/delivery/send-follow-accepted-notification.use-case";
import { SendFollowRequestNotification } from "#api/modules/notification/application/use-cases/delivery/send-follow-request-notification.use-case";
import { SendMilestoneNotification } from "#api/modules/notification/application/use-cases/delivery/send-milestone-notification.use-case";
import { SendNotificationWithDedup } from "#api/modules/notification/application/use-cases/delivery/send-notification-with-dedup.use-case";
import { SendNotification } from "#api/modules/notification/application/use-cases/delivery/send-notification.use-case";
import { SendNudgeNotification } from "#api/modules/notification/application/use-cases/delivery/send-nudge-notification.use-case";
import { UnregisterPushToken } from "#api/modules/notification/application/use-cases/delivery/unregister-push-token.use-case";
import { ProcessRetentionStages } from "#api/modules/notification/application/use-cases/retention/process-retention-stages.use-case";
import { RelayRetentionOutbox } from "#api/modules/notification/application/use-cases/retention/relay-retention-outbox.use-case";
import { CachedActivePushTokenReaderAdapter } from "#api/modules/notification/infrastructure/adapters/delivery/cached-active-push-token-reader.adapter";
import { CachedNotificationRecipientPreferenceAdapter } from "#api/modules/notification/infrastructure/adapters/delivery/cached-notification-recipient-preference.adapter";
import { NotificationCacheAdapter } from "#api/modules/notification/infrastructure/adapters/delivery/notification-cache.adapter";
import { NotificationDedupAdapter } from "#api/modules/notification/infrastructure/adapters/delivery/notification-dedup.adapter";
import { ExpoRetentionPushSenderAdapter } from "#api/modules/notification/infrastructure/adapters/retention/expo-retention-push-sender.adapter";
import { NotificationQueueProcessor } from "#api/modules/notification/infrastructure/jobs/delivery/notification-queue.processor";
import { PushDeliveryQueueProcessor } from "#api/modules/notification/infrastructure/jobs/delivery/push-delivery-queue.processor";
import { PushDeliveryQueueService } from "#api/modules/notification/infrastructure/jobs/delivery/push-delivery-queue.service";
import { RetentionQueueProcessor } from "#api/modules/notification/infrastructure/jobs/retention/retention-queue.processor";
import { PrismaNotificationReader } from "#api/modules/notification/infrastructure/persistence/delivery/prisma-notification.reader";
import { PrismaNotificationRepository } from "#api/modules/notification/infrastructure/persistence/delivery/prisma-notification.repository";
import { PrismaPushDeliveryLifecycleRepository } from "#api/modules/notification/infrastructure/persistence/delivery/prisma-push-delivery-lifecycle.repository";
import { PrismaPushDeliveryOutboxRepository } from "#api/modules/notification/infrastructure/persistence/delivery/prisma-push-delivery-outbox.repository";
import { PrismaPushDispatchStagingRepository } from "#api/modules/notification/infrastructure/persistence/delivery/prisma-push-dispatch-staging.repository";
import { PrismaPushReceiptRepository } from "#api/modules/notification/infrastructure/persistence/delivery/prisma-push-receipt.repository";
import { PrismaPushTokenRepository } from "#api/modules/notification/infrastructure/persistence/delivery/prisma-push-token.repository";
import { PrismaRetentionRepository } from "#api/modules/notification/infrastructure/persistence/retention/prisma-retention.repository";
import { InMemoryPushRateLimiter } from "#api/modules/notification/infrastructure/rate-limiter/delivery/in-memory-push-rate-limiter";
import {
  deliverPushNotificationsProvider,
  finalizeBatchNotificationProvider,
  findAlreadyNotifiedUsersProvider,
  persistBatchNotificationProvider,
  publishPushDeliveryOutboxProvider,
  pushDeliveryAfterCommitPublisherProvider,
  pushDeliveryEligibilityServiceProvider,
  pushNotificationDeliveryServiceProvider,
  pushNotificationPayloadFactoryProvider,
  recoverFailedPushDeliveriesProvider,
  relayPushDeliveryOutboxProvider,
  sendFriendCompletionNotificationsProvider,
} from "#api/modules/notification/notification-delivery-application.providers";
import {
  MARKETING_PUSH_OPT_OUT_TOKEN,
  PUSH_PROVIDER,
  PUSH_RATE_LIMITER,
} from "#api/modules/notification/notification-delivery.public";
import {
  dispatchRetentionPushProvider,
  recoverFailedRetentionDeliveryProvider,
} from "#api/modules/notification/notification-retention-application.providers";
import { InMemoryCacheAdapter } from "#api/platform/cache/adapters/in-memory-cache.adapter";
import { CacheService } from "#api/platform/cache/cache.service";
import { CACHE_SERVICE } from "#api/platform/cache/interfaces/cache.interface";
import { ClsUnitOfWork } from "#api/platform/database/cls-unit-of-work";
import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { DatabaseService } from "#api/platform/database/database.service";
import { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import { InMemoryDedupAdapter } from "#api/platform/dedup/adapters/in-memory-dedup.adapter";
import { DEDUP_PROVIDER } from "#api/platform/dedup/interfaces/dedup.interface";
import { PgBossJobRuntimeAdapter } from "#api/platform/jobs/pg-boss-job-runtime.adapter";
import {
  AFTER_COMMIT_TASK_REGISTRY,
  JOB_RUNTIME,
  type JobRuntimePort,
  UNIT_OF_WORK,
} from "#api/shared/application/ports/index";
import { FakePushProvider } from "#test/mocks/fake-push.provider";
import { createTestDatabaseService } from "#test/setup/database-context";
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
  static register(prisma: TestDatabaseClient): DynamicModule {
    return {
      module: CriticalQueueDatabaseModule,
      providers: [{ provide: DatabaseService, useValue: createTestDatabaseService(prisma) }],
      exports: [DatabaseService],
    };
  }
}

export interface CriticalQueueProcessorHarness {
  readonly prisma: TestDatabaseClient;
  readonly boss: PgBoss;
  readonly runtime: JobRuntimePort;
  readonly pushProvider: FakePushProvider;
  readonly retentionRepository: PrismaRetentionRepository;
  readonly daytimeTimezone: string;
  cleanup(): Promise<void>;
  eventually(assertion: () => Promise<void>): Promise<void>;
  close(): Promise<void>;
}

export async function createCriticalQueueProcessorHarness(): Promise<CriticalQueueProcessorHarness> {
  suppressLogger();
  const testDatabase = new TestDatabase();
  const prisma = await testDatabase.start();
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
  const databaseModule = CriticalQueueDatabaseModule.register(prisma);
  const module = await Test.createTestingModule({
    imports: [
      databaseModule,
      ClsModule.forRoot({
        global: true,
        plugins: [
          new ClsPluginTransactional({
            imports: [databaseModule],
            adapter: new Prisma8TransactionalAdapter(),
          }),
        ],
      }),
    ],
    providers: [
      ClsUnitOfWork,
      { provide: UNIT_OF_WORK, useExisting: ClsUnitOfWork },
      { provide: AFTER_COMMIT_TASK_REGISTRY, useExisting: ClsUnitOfWork },
      {
        provide: JOB_RUNTIME,
        inject: [TransactionHost],
        useFactory: (txHost: TransactionHost<Prisma8TransactionalAdapter>) =>
          new PgBossJobRuntimeAdapter(boss, txHost, {
            job: { shutdownTimeoutMs: 10_000 },
          }),
      },
      ...notificationProviders(pushProvider),
      ...retentionProviders(),
    ],
  }).compile();

  const runtime = module.get<JobRuntimePort>(JOB_RUNTIME);
  await runtime.start();
  await module.init();

  return {
    prisma,
    boss,
    runtime,
    pushProvider,
    retentionRepository: module.get(PrismaRetentionRepository),
    daytimeTimezone,
    cleanup: async () => {
      await testDatabase.cleanup();
      pushProvider.clear();
      await module.get(CacheService).reset();
    },
    eventually: async (assertion) => {
      await eventually(assertion);
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
    {
      provide: NotificationPublisher,
      inject: [SendNotification, SendNotificationWithDedup, SendBatchNotification],
      useFactory: (
        sendNotification: SendNotification,
        sendWithDedup: SendNotificationWithDedup,
        sendBatch: SendBatchNotification,
      ) => new NotificationPublisher(sendNotification, sendWithDedup, sendBatch),
    },
    {
      provide: NotificationHistoryReader,
      inject: [FindAlreadyNotifiedUsers],
      useFactory: (findAlreadyNotified: FindAlreadyNotifiedUsers) =>
        new NotificationHistoryReader(findAlreadyNotified),
    },
    {
      provide: NotificationRecipientLocaleReader,
      inject: [NOTIFICATION_RECIPIENT_LOCALE_READER],
      useFactory: (localeReader: NotificationRecipientLocaleReaderPort) =>
        new NotificationRecipientLocaleReader(localeReader),
    },
    persistBatchNotificationProvider,
    finalizeBatchNotificationProvider,
    findAlreadyNotifiedUsersProvider,
    {
      provide: GetNotifications,
      useValue: unexpectedUseCase,
    },
    { provide: GetUnreadCount, useValue: unexpectedUseCase },
    { provide: MarkAsRead, useValue: unexpectedUseCase },
    { provide: MarkNotificationOpened, useValue: unexpectedUseCase },
    { provide: MarkAllAsRead, useValue: unexpectedUseCase },
    { provide: RegisterPushToken, useValue: unexpectedUseCase },
    { provide: UnregisterPushToken, useValue: unexpectedUseCase },
    { provide: OptOutMarketingPush, useValue: unexpectedUseCase },
    { provide: SendNotification, useValue: unexpectedUseCase },
    { provide: SendNotificationWithDedup, useValue: unexpectedUseCase },
    { provide: SendBatchNotification, useValue: unexpectedUseCase },
    PrismaNotificationRepository,
    { provide: NOTIFICATION_REPOSITORY, useExisting: PrismaNotificationRepository },
    PrismaNotificationReader,
    { provide: NOTIFICATION_INBOX_READER, useExisting: PrismaNotificationReader },
    { provide: NOTIFICATION_HISTORY_READER, useExisting: PrismaNotificationReader },
    PrismaPushTokenRepository,
    { provide: PUSH_TOKEN_REPOSITORY, useExisting: PrismaPushTokenRepository },
    PrismaPushReceiptRepository,
    { provide: PUSH_RECEIPT_REPOSITORY, useExisting: PrismaPushReceiptRepository },
    PrismaPushDispatchStagingRepository,
    { provide: PUSH_DISPATCH_STAGING, useExisting: PrismaPushDispatchStagingRepository },
    PrismaPushDeliveryOutboxRepository,
    {
      provide: PUSH_DELIVERY_OUTBOX_REPOSITORY,
      useExisting: PrismaPushDeliveryOutboxRepository,
    },
    PrismaPushDeliveryLifecycleRepository,
    {
      provide: PUSH_DELIVERY_LIFECYCLE_REPOSITORY,
      useExisting: PrismaPushDeliveryLifecycleRepository,
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
      provide: CACHE_SERVICE,
      useFactory: () =>
        new InMemoryCacheAdapter({
          defaultTtlMs: 60_000,
          maxItems: 100,
        }),
    },
    CacheService,
    NotificationCacheAdapter,
    { provide: NOTIFICATION_CACHE, useExisting: NotificationCacheAdapter },
    InMemoryDedupAdapter,
    { provide: DEDUP_PROVIDER, useExisting: InMemoryDedupAdapter },
    NotificationDedupAdapter,
    { provide: NOTIFICATION_DEDUP, useExisting: NotificationDedupAdapter },
    {
      provide: USER_NOTIFICATION_SETTINGS,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService): UserNotificationSettingsPort =>
        createDatabaseBackedSettingsPort(database),
    },
    CachedActivePushTokenReaderAdapter,
    { provide: ACTIVE_PUSH_TOKEN_READER, useExisting: CachedActivePushTokenReaderAdapter },
    UserPreferenceRepository,
    {
      provide: USER_PREFERENCE_READER,
      useFactory: (preferenceRepository: UserPreferenceRepository, cache: CacheService) =>
        new UserPreferenceReader({
          preferenceRepository,
          cache: new UserSettingsCacheAdapter(cache),
        }),
      inject: [UserPreferenceRepository, CacheService],
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
    dispatchRetentionPushProvider,
    recoverFailedRetentionDeliveryProvider,
    {
      provide: ProcessRetentionStages,
      useValue: unexpectedUseCase,
    },
    { provide: RelayRetentionOutbox, useValue: unexpectedUseCase },
    PrismaRetentionRepository,
    { provide: RETENTION_REPOSITORY, useExisting: PrismaRetentionRepository },
    {
      provide: RETENTION_PUSH_SENDER,
      useClass: ExpoRetentionPushSenderAdapter,
    },
    { provide: RETENTION_CONFIG, useValue: config },
  ];
}

function createDatabaseBackedSettingsPort(database: DatabaseService): UserNotificationSettingsPort {
  return {
    upsertPushTimezone: async (userId, timezone) => {
      decodeRecord(
        "UserPreference",
        await database.db.orm.public.UserPreference.where((row) => row.userId.eq(userId)).upsert({
          conflictOn: encodePatch("UserPreference", { userId }),
          create: encodeCreate("UserPreference", { userId, timezone }),
          update: encodePatch("UserPreference", { timezone }),
        }),
      );
    },
    upsertPushLocale: async (userId, locale) => {
      decodeRecord(
        "UserPreference",
        await database.db.orm.public.UserPreference.where((row) => row.userId.eq(userId)).upsert({
          conflictOn: encodePatch("UserPreference", { userId }),
          create: encodeCreate("UserPreference", { userId, locale }),
          update: encodePatch("UserPreference", { locale }),
        }),
      );
    },
    getPreferenceRecord: async (userId): Promise<UserPreferenceRecord | null> =>
      database.db.orm.public.UserPreference.where((row) => row.userId.eq(userId))
        .first()
        .then((row) => decodeRecord("UserPreference", row)),
    getPreferenceRecordsByUserIds: async (userIds): Promise<UserPreferenceRecordWithId[]> =>
      database.db.orm.public.UserPreference.where((row) => row.userId.in(userIds))
        .all()
        .then((row) => decodeRecord("UserPreference", row)),
    getConsentRecord: async (userId): Promise<UserConsentRecord | null> =>
      database.db.orm.public.UserConsent.where((row) => row.userId.eq(userId))
        .first()
        .then((row) => decodeRecord("UserConsent", row)),
    getConsentRecordsByUserIds: async (userIds): Promise<UserConsentRecordWithId[]> =>
      database.db.orm.public.UserConsent.where((row) => row.userId.in(userIds))
        .all()
        .then((row) => decodeRecord("UserConsent", row)),
    updateMarketingPushConsent: async (userId, agreed) => {
      decodeRecord(
        "UserConsent",
        await database.db.orm.public.UserConsent.where((row) => row.userId.eq(userId)).upsert({
          conflictOn: encodePatch("UserConsent", { userId }),
          create: encodeCreate("UserConsent", {
            userId,
            marketingPushAgreedAt: agreed ? new Date() : null,
          }),
          update: encodePatch("UserConsent", {
            marketingPushAgreedAt: agreed ? new Date() : null,
          }),
        }),
      );
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
    if (hour >= 9 && hour < 20) return timezone;
  }
  throw new Error("No daytime IANA timezone available for retention test");
}
