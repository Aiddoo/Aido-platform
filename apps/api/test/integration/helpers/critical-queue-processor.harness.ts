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
  UserPreferenceReaderPort,
  UserSettingsCachePort,
} from "#api/modules/identity/identity-settings.public";
import { ReadUserPreferencesUseCase } from "#api/modules/identity/preferences/application/use-cases/read-user-preferences.use-case";
import { UserSettingsCacheAdapter } from "#api/modules/identity/preferences/infrastructure/adapters/user-settings-cache.adapter";
import { DrizzleUserPreferenceRepository } from "#api/modules/identity/preferences/infrastructure/persistence/drizzle-user-preference.repository";
import { NOTIFICATION_INBOX_PROVIDERS } from "#api/modules/notification/inbox/notification-inbox.providers";
import { MarketingConsentReconfirmPort } from "#api/modules/notification/push/application/ports/marketing-consent-reconfirm.port";
import { MarketingPushOptOutTokenPort } from "#api/modules/notification/push/application/ports/marketing-push-opt-out-token.port";
import { PushProviderPort } from "#api/modules/notification/push/application/ports/push-provider.port";
import { PushRateLimiterPort } from "#api/modules/notification/push/application/ports/push-rate-limiter.port";
import { UserNotificationSettingsPort } from "#api/modules/notification/push/application/ports/user-notification-settings.port";
import { OptOutMarketingPushUseCase } from "#api/modules/notification/push/application/use-cases/opt-out-marketing-push.use-case";
import { ReconcilePushReceiptsUseCase } from "#api/modules/notification/push/application/use-cases/reconcile-push-receipts.use-case";
import { ReportPushDeviceUseCase } from "#api/modules/notification/push/application/use-cases/report-push-device.use-case";
import { SendBillingIssueNotificationUseCase } from "#api/modules/notification/push/application/use-cases/send-billing-issue-notification.use-case";
import { SendCheerNotificationUseCase } from "#api/modules/notification/push/application/use-cases/send-cheer-notification.use-case";
import { SendFollowAcceptedNotificationUseCase } from "#api/modules/notification/push/application/use-cases/send-follow-accepted-notification.use-case";
import { SendFollowRequestNotificationUseCase } from "#api/modules/notification/push/application/use-cases/send-follow-request-notification.use-case";
import { SendMilestoneNotificationUseCase } from "#api/modules/notification/push/application/use-cases/send-milestone-notification.use-case";
import { SendNotificationWithDedupUseCase } from "#api/modules/notification/push/application/use-cases/send-notification-with-dedup.use-case";
import { SendNudgeNotificationUseCase } from "#api/modules/notification/push/application/use-cases/send-nudge-notification.use-case";
import { UnregisterPushDeviceUseCase } from "#api/modules/notification/push/application/use-cases/unregister-push-device.use-case";
import { InMemoryPushRateLimiterAdapter } from "#api/modules/notification/push/infrastructure/adapters/in-memory-push-rate-limiter.adapter";
import { NotificationQueueProcessor } from "#api/modules/notification/push/infrastructure/jobs/notification-queue.processor";
import { PushDeliveryQueueProcessor } from "#api/modules/notification/push/infrastructure/jobs/push-delivery-queue.processor";
import { PUSH_DELIVERY_QUEUE } from "#api/modules/notification/push/infrastructure/jobs/push-delivery.queue";
import {
  NOTIFICATION_PUSH_PERSISTENCE_PROVIDERS,
  NOTIFICATION_PUSH_USE_CASE_PROVIDERS,
} from "#api/modules/notification/push/notification-push.providers";
import { ExperimentAssignerPort } from "#api/modules/notification/retention/application/ports/experiment-assigner.port";
import { RetentionConfigPort } from "#api/modules/notification/retention/application/ports/retention-config.port";
import { DeterministicHashExperimentAssignerAdapter } from "#api/modules/notification/retention/infrastructure/adapters/deterministic-hash-experiment-assigner.adapter";
import { RetentionQueueProcessor } from "#api/modules/notification/retention/infrastructure/jobs/retention-queue.processor";
import { DrizzleRetentionRepository } from "#api/modules/notification/retention/infrastructure/persistence/drizzle-retention.repository";
import {
  NOTIFICATION_RETENTION_PERSISTENCE_PROVIDERS,
  NOTIFICATION_RETENTION_USE_CASE_PROVIDERS,
} from "#api/modules/notification/retention/notification-retention.providers";
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
import { InMemoryLockAdapter } from "#api/platform/lock/adapters/in-memory-lock.adapter";
import { LOCK_PROVIDER } from "#api/platform/lock/interfaces/lock.interface";
import { SystemClock } from "#api/platform/time/system-clock";
import { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { JobQueuePort, UnitOfWorkPort } from "#api/shared/application/ports/index";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { FakePushProvider } from "#test/doubles/notification/fake-push-provider";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
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
  readonly jobQueue: JobQueuePort;
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
      { provide: UnitOfWorkPort, useExisting: ClsUnitOfWork },
      { provide: AfterCommitTaskRegistryPort, useExisting: ClsUnitOfWork },
      { provide: ClockPort, useClass: SystemClock },
      JobQueueRegistry,
      {
        provide: JobQueuePort,
        inject: [TransactionHost, JobQueueRegistry],
        useFactory: (
          txHost: TransactionHost<DrizzleTransactionalAdapter>,
          registry: JobQueueRegistry,
        ) => new PgBossJobQueueAdapter(boss, txHost, registry, { shutdownTimeoutMs: 10_000 }),
      },
      ...notificationProviders(pushProvider),
      ...retentionProviders(),
      ...broadcastProviders(),
    ],
  }).compile();

  const jobQueue = module.get(JobQueuePort);
  await jobQueue.start();
  await module.init();

  return {
    client,
    boss,
    jobQueue,
    pushProvider,
    module,
    retentionRepository: module.get(DrizzleRetentionRepository),
    daytimeTimezone,
    cleanup: async () => {
      await testDatabase.cleanup();
      // DB 정리가 dispatch id를 처음부터 다시 쓰므로 같은 publication key로 남은 지난 발송 작업을 지운다
      await boss.deleteAllJobs(PUSH_DELIVERY_QUEUE.name);
      pushProvider.clear();
      await module.get(CacheService).reset();
    },
    eventually: async (assertion, timeoutMs) => {
      await eventually(assertion, timeoutMs);
    },
    close: async () => {
      await jobQueue.stop();
      await module.close();
      await testDatabase.stop();
    },
  };
}

function notificationProviders(pushProvider: FakePushProvider): Provider[] {
  return [
    ...NOTIFICATION_INBOX_PROVIDERS,
    ...NOTIFICATION_PUSH_PERSISTENCE_PROVIDERS,
    ...NOTIFICATION_PUSH_USE_CASE_PROVIDERS,
    NotificationQueueProcessor,
    PushDeliveryQueueProcessor,
    // 큐 처리기가 부르지 않을 UseCase는 실수로 불리면 바로 드러나게 바꿔 둔다
    { provide: SendFollowRequestNotificationUseCase, useValue: unexpectedUseCase },
    { provide: SendFollowAcceptedNotificationUseCase, useValue: unexpectedUseCase },
    { provide: SendNudgeNotificationUseCase, useValue: unexpectedUseCase },
    { provide: SendCheerNotificationUseCase, useValue: unexpectedUseCase },
    { provide: SendBillingIssueNotificationUseCase, useValue: unexpectedUseCase },
    { provide: SendMilestoneNotificationUseCase, useValue: unexpectedUseCase },
    { provide: ReconcilePushReceiptsUseCase, useValue: unexpectedUseCase },
    { provide: ReportPushDeviceUseCase, useValue: unexpectedUseCase },
    { provide: UnregisterPushDeviceUseCase, useValue: unexpectedUseCase },
    { provide: OptOutMarketingPushUseCase, useValue: unexpectedUseCase },
    { provide: SendNotificationWithDedupUseCase, useValue: unexpectedUseCase },
    { provide: PushProviderPort, useValue: pushProvider },
    { provide: PushRateLimiterPort, useClass: InMemoryPushRateLimiterAdapter },
    {
      provide: MarketingPushOptOutTokenPort,
      useValue: {
        issue: (userId: string) => `fake-opt-out:${userId}`,
        verify: (token: string) =>
          token.startsWith("fake-opt-out:") ? token.slice("fake-opt-out:".length) : null,
      },
    },
    {
      provide: MarketingConsentReconfirmPort,
      useValue: {
        findMarketingReconfirmTargets: unexpectedUseCase.execute,
        claimMarketingReconfirm: unexpectedUseCase.execute,
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
    { provide: UserSettingsCachePort, useExisting: UserSettingsCacheAdapter },
    InMemoryDedupAdapter,
    { provide: DEDUP_PROVIDER, useExisting: InMemoryDedupAdapter },
    { provide: LOCK_PROVIDER, useFactory: () => new InMemoryLockAdapter() },
    {
      provide: UserNotificationSettingsPort,
      inject: [DRIZZLE],
      useFactory: (database: Database): UserNotificationSettingsPort =>
        createDatabaseBackedSettingsPort(database),
    },
    DrizzleUserPreferenceRepository,
    {
      provide: UserPreferenceReaderPort,
      useFactory: (preferenceRepository: DrizzleUserPreferenceRepository, cache: CacheService) =>
        new ReadUserPreferencesUseCase({
          preferenceRepository,
          cache: new UserSettingsCacheAdapter(cache),
        }),
      inject: [DrizzleUserPreferenceRepository, CacheService],
    },
  ];
}

function retentionProviders(): Provider[] {
  const config: RetentionConfigPort = {
    enabled: true,
    treatmentPercent: 100,
  };
  return [
    RetentionQueueProcessor,
    ...NOTIFICATION_RETENTION_PERSISTENCE_PROVIDERS,
    ...NOTIFICATION_RETENTION_USE_CASE_PROVIDERS,
    { provide: RetentionConfigPort, useValue: config },
    { provide: ExperimentAssignerPort, useClass: DeterministicHashExperimentAssignerAdapter },
  ];
}

function broadcastProviders(): Provider[] {
  return [
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
    upsertPushTimezone: (userId, timezone) => upsertPreference(userId.value, { timezone }),
    upsertPushLocale: (userId, locale) => upsertPreference(userId.value, { locale }),
    getPreferenceRecord: async (userId): Promise<UserPreferenceRecord | null> =>
      (await database.query.userPreference.findFirst({ where: { userId: userId.value } })) ?? null,
    getPreferenceRecordsByUserIds: async (userIds): Promise<UserPreferenceRecordWithId[]> =>
      userIds.length === 0
        ? []
        : database.query.userPreference.findMany({
            where: { userId: { in: userIds.map((userId) => userId.value) } },
          }),
    getConsentRecord: async (userId): Promise<UserConsentRecord | null> =>
      (await database.query.userConsent.findFirst({ where: { userId: userId.value } })) ?? null,
    getConsentRecordsByUserIds: async (userIds): Promise<UserConsentRecordWithId[]> =>
      userIds.length === 0
        ? []
        : database.query.userConsent.findMany({
            where: { userId: { in: userIds.map((userId) => userId.value) } },
          }),
    updateMarketingPushConsent: async (user, agreed) => {
      const userId = user.value;
      const marketingPushAgreedAt = agreed
        ? Temporal.Instant.fromEpochMilliseconds(Date.now())
        : null;
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
