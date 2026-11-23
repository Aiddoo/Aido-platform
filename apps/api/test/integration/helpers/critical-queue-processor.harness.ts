import { ClsPluginTransactional, TransactionHost } from "@nestjs-cls/transactional";
import { TransactionalAdapterDrizzleOrm } from "@nestjs-cls/transactional-adapter-drizzle-orm";
import { type DynamicModule, Module, type Provider } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { ClsModule } from "nestjs-cls";
import { PgBoss } from "pg-boss";

import { ReadUserPreferencesUseCase } from "#api/modules/identity/user-preferences/application/use-cases/read-user-preferences.use-case";
import {
  type UserConsentReadModel,
  UserPreferenceReaderPort,
  type UserPreferenceReadModel,
  UserSettingsCachePort,
} from "#api/modules/identity/user-preferences/identity-user-preferences.public";
import { UserPreferenceReaderAdapter } from "#api/modules/identity/user-preferences/infrastructure/adapters/user-preference-reader.adapter";
import { UserSettingsCacheAdapter } from "#api/modules/identity/user-preferences/infrastructure/adapters/user-settings-cache.adapter";
import { DrizzleUserPreferenceRepository } from "#api/modules/identity/user-preferences/infrastructure/persistence/drizzle-user-preference.repository";
import { MarketingConsentReconfirmPort } from "#api/modules/notification/notifications/application/ports/marketing-consent-reconfirm.port";
import { UnreadNotificationCountReaderPort } from "#api/modules/notification/notifications/application/ports/unread-notification-count.reader.port";
import { SendBillingIssueNotificationUseCase } from "#api/modules/notification/notifications/application/use-cases/send-billing-issue-notification.use-case";
import { SendCheerNotificationUseCase } from "#api/modules/notification/notifications/application/use-cases/send-cheer-notification.use-case";
import { SendFollowAcceptedNotificationUseCase } from "#api/modules/notification/notifications/application/use-cases/send-follow-accepted-notification.use-case";
import { SendFollowRequestNotificationUseCase } from "#api/modules/notification/notifications/application/use-cases/send-follow-request-notification.use-case";
import { SendMilestoneNotificationUseCase } from "#api/modules/notification/notifications/application/use-cases/send-milestone-notification.use-case";
import { SendNotificationWithDeduplicationUseCase } from "#api/modules/notification/notifications/application/use-cases/send-notification-with-deduplication.use-case";
import { SendNudgeNotificationUseCase } from "#api/modules/notification/notifications/application/use-cases/send-nudge-notification.use-case";
import { NotificationQueueProcessor } from "#api/modules/notification/notifications/infrastructure/jobs/notification-queue.processor";
import { DrizzleNotificationReader } from "#api/modules/notification/notifications/infrastructure/persistence/drizzle-notification.reader";
import { NOTIFICATION_NOTIFICATIONS_PROVIDERS } from "#api/modules/notification/notifications/notification-notifications.providers";
import { ReportPushDeviceUseCase } from "#api/modules/notification/push-devices/application/use-cases/report-push-device.use-case";
import { UnregisterPushDeviceUseCase } from "#api/modules/notification/push-devices/application/use-cases/unregister-push-device.use-case";
import {
  NOTIFICATION_PUSH_DEVICES_PERSISTENCE_PROVIDERS,
  NOTIFICATION_PUSH_DEVICES_USE_CASE_PROVIDERS,
} from "#api/modules/notification/push-devices/notification-push-devices.providers";
import { MarketingPushOptOutTokenPort } from "#api/modules/notification/push-dispatches/application/ports/marketing-push-opt-out-token.port";
import { PushChannelRegistryPort } from "#api/modules/notification/push-dispatches/application/ports/push-channel-registry.port";
import { PushRateLimiterPort } from "#api/modules/notification/push-dispatches/application/ports/push-rate-limiter.port";
import { OptOutMarketingPushUseCase } from "#api/modules/notification/push-dispatches/application/use-cases/opt-out-marketing-push.use-case";
import { ReconcilePushReceiptsUseCase } from "#api/modules/notification/push-dispatches/application/use-cases/reconcile-push-receipts.use-case";
import { InMemoryPushRateLimiterAdapter } from "#api/modules/notification/push-dispatches/infrastructure/adapters/in-memory-push-rate-limiter.adapter";
import { PushDeliveryQueueProcessor } from "#api/modules/notification/push-dispatches/infrastructure/jobs/push-delivery-queue.processor";
import { PUSH_DELIVERY_QUEUE } from "#api/modules/notification/push-dispatches/infrastructure/jobs/push-delivery.queue";
import {
  NOTIFICATION_PUSH_DISPATCHES_PERSISTENCE_PROVIDERS,
  NOTIFICATION_PUSH_DISPATCHES_USE_CASE_PROVIDERS,
} from "#api/modules/notification/push-dispatches/notification-push-dispatches.providers";
import { ExperimentAssignerPort } from "#api/modules/notification/retention-assignments/application/ports/experiment-assigner.port";
import { RetentionConfigPort } from "#api/modules/notification/retention-assignments/application/ports/retention-config.port";
import { DeterministicHashExperimentAssignerAdapter } from "#api/modules/notification/retention-assignments/infrastructure/adapters/deterministic-hash-experiment-assigner.adapter";
import { RetentionQueueProcessor } from "#api/modules/notification/retention-assignments/infrastructure/jobs/retention-queue.processor";
import { DrizzleRetentionAssignmentRepository } from "#api/modules/notification/retention-assignments/infrastructure/persistence/drizzle-retention-assignment.repository";
import {
  NOTIFICATION_RETENTION_ASSIGNMENTS_PERSISTENCE_PROVIDERS,
  NOTIFICATION_RETENTION_ASSIGNMENTS_USE_CASE_PROVIDERS,
} from "#api/modules/notification/retention-assignments/notification-retention-assignments.providers";
import { UserNotificationSettingsPort } from "#api/modules/notification/shared/application/ports/user-notification-settings.port";
import { AdminBroadcastNotifierPort } from "#api/modules/operations/broadcast-campaigns/application/ports/admin-broadcast-notifier.port";
import { AdminUserDirectoryReaderPort } from "#api/modules/operations/broadcast-campaigns/application/ports/admin-user-directory.reader.port";
import { BroadcastCampaignRepositoryPort } from "#api/modules/operations/broadcast-campaigns/application/ports/broadcast-campaign.repository.port";
import { BroadcastJobEnqueuerPort } from "#api/modules/operations/broadcast-campaigns/application/ports/broadcast-job-enqueuer.port";
import { BroadcastRecipientReaderPort } from "#api/modules/operations/broadcast-campaigns/application/ports/broadcast-recipient.reader.port";
import { CreateBroadcastCampaignUseCase } from "#api/modules/operations/broadcast-campaigns/application/use-cases/create-broadcast-campaign.use-case";
import { DeliverBroadcastGroupUseCase } from "#api/modules/operations/broadcast-campaigns/application/use-cases/deliver-broadcast-group.use-case";
import { FailBroadcastCampaignUseCase } from "#api/modules/operations/broadcast-campaigns/application/use-cases/fail-broadcast-campaign.use-case";
import { FanOutBroadcastCampaignUseCase } from "#api/modules/operations/broadcast-campaigns/application/use-cases/fan-out-broadcast-campaign.use-case";
import { ReportBroadcastDeliveryExhaustedUseCase } from "#api/modules/operations/broadcast-campaigns/application/use-cases/report-broadcast-delivery-exhausted.use-case";
import { BroadcastJobEnqueuerAdapter } from "#api/modules/operations/broadcast-campaigns/infrastructure/adapters/broadcast-job-enqueuer.adapter";
import { NotificationAdminBroadcastNotifierAdapter } from "#api/modules/operations/broadcast-campaigns/infrastructure/adapters/notification-admin-broadcast-notifier.adapter";
import { NotificationBroadcastRecipientAdapter } from "#api/modules/operations/broadcast-campaigns/infrastructure/adapters/notification-broadcast-recipient.adapter";
import { BroadcastDeliveryProcessor } from "#api/modules/operations/broadcast-campaigns/infrastructure/jobs/broadcast-delivery.processor";
import { BroadcastFanOutProcessor } from "#api/modules/operations/broadcast-campaigns/infrastructure/jobs/broadcast-fan-out.processor";
import { DrizzleAdminUserDirectoryReader } from "#api/modules/operations/broadcast-campaigns/infrastructure/persistence/drizzle-admin-user-directory.reader";
import { DrizzleBroadcastCampaignRepository } from "#api/modules/operations/broadcast-campaigns/infrastructure/persistence/drizzle-broadcast-campaign.repository";
import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import { ClsUnitOfWork } from "#api/platform/database/cls-unit-of-work";
import {
  type Database,
  DRIZZLE,
  type DrizzleTransactionalAdapter,
} from "#api/platform/database/database.client";
import { userConsent, userPreference } from "#api/platform/database/schema/index";
import { InMemoryDedupAdapter } from "#api/platform/dedup/adapters/in-memory-dedup.adapter";
import { DedupProviderPort } from "#api/platform/dedup/dedup-provider.port";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { JobQueueRegistry } from "#api/platform/jobs/job-queue.registry";
import { PgBossJobQueueAdapter } from "#api/platform/jobs/pg-boss-job-queue.adapter";
import { SystemClock } from "#api/platform/time/system-clock";
import { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  FakePushChannel,
  pushChannelRegistryOf,
} from "#test/doubles/notification/fake-push-channel";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import { suppressLogger } from "#test/setup/suppress-logger";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import { FastJobQueue } from "./fast-job-timing.js";

const PG_BOSS_SCHEMA = "pgboss_critical_processors";

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
  readonly pushProvider: FakePushChannel;
  readonly module: TestingModule;
  readonly retentionRepository: DrizzleRetentionAssignmentRepository;
  readonly daytimeTimezone: string;
  cleanup(): Promise<void>;
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
  const pushProvider = new FakePushChannel();
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
          transactionHost: TransactionHost<DrizzleTransactionalAdapter>,
          registry: JobQueueRegistry,
        ) =>
          new FastJobQueue(
            new PgBossJobQueueAdapter(boss, transactionHost, registry, {
              shutdownTimeoutMs: 10_000,
              workerEnabled: true,
            }),
          ),
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
    retentionRepository: module.get(DrizzleRetentionAssignmentRepository),
    daytimeTimezone,
    cleanup: async () => {
      await testDatabase.cleanup();
      // DB 정리가 dispatch id를 처음부터 다시 쓰므로 같은 publication key로 남은 지난 발송 작업을 지운다
      await boss.deleteAllJobs(PUSH_DELIVERY_QUEUE.name);
      pushProvider.clear();
      await module.get(CacheStorePort).reset();
    },
    close: async () => {
      await jobQueue.stop();
      await module.close();
      await testDatabase.stop();
    },
  };
}

function notificationProviders(pushProvider: FakePushChannel): Provider[] {
  return [
    ...NOTIFICATION_NOTIFICATIONS_PROVIDERS,
    ...NOTIFICATION_PUSH_DEVICES_PERSISTENCE_PROVIDERS,
    ...NOTIFICATION_PUSH_DEVICES_USE_CASE_PROVIDERS,
    ...NOTIFICATION_PUSH_DISPATCHES_PERSISTENCE_PROVIDERS,
    ...NOTIFICATION_PUSH_DISPATCHES_USE_CASE_PROVIDERS,
    {
      provide: UnreadNotificationCountReaderPort,
      useClass: DrizzleNotificationReader,
    },
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
    { provide: SendNotificationWithDeduplicationUseCase, useValue: unexpectedUseCase },
    { provide: PushChannelRegistryPort, useValue: pushChannelRegistryOf(pushProvider) },
    { provide: PushRateLimiterPort, useClass: InMemoryPushRateLimiterAdapter },
    {
      provide: MarketingPushOptOutTokenPort,
      useValue: {
        issue: (userId: UserId) => `fake-opt-out:${userId.value}`,
        verify: (token: string) =>
          token.startsWith("fake-opt-out:")
            ? UserId.reconstitute(token.slice("fake-opt-out:".length))
            : null,
      },
    },
    {
      provide: MarketingConsentReconfirmPort,
      useValue: {
        listMarketingReconfirmTargets: unexpectedUseCase.execute,
        claimMarketingReconfirm: unexpectedUseCase.execute,
      } satisfies MarketingConsentReconfirmPort,
    },
    {
      provide: CacheStorePort,
      useFactory: () =>
        new InMemoryCacheStore({
          defaultTtlMs: 60_000,
          maxItems: 100,
        }),
    },
    UserSettingsCacheAdapter,
    { provide: UserSettingsCachePort, useExisting: UserSettingsCacheAdapter },
    InMemoryDedupAdapter,
    { provide: DedupProviderPort, useExisting: InMemoryDedupAdapter },
    {
      provide: UserNotificationSettingsPort,
      inject: [DRIZZLE],
      useFactory: (database: Database): UserNotificationSettingsPort =>
        createDatabaseBackedSettingsPort(database),
    },
    DrizzleUserPreferenceRepository,
    {
      provide: UserPreferenceReaderPort,
      useFactory: (preferenceRepository: DrizzleUserPreferenceRepository, cache: CacheStorePort) =>
        new UserPreferenceReaderAdapter(
          new ReadUserPreferencesUseCase({
            preferenceRepository,
            cache: new UserSettingsCacheAdapter(cache),
          }),
        ),
      inject: [DrizzleUserPreferenceRepository, CacheStorePort],
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
    ...NOTIFICATION_RETENTION_ASSIGNMENTS_PERSISTENCE_PROVIDERS,
    ...NOTIFICATION_RETENTION_ASSIGNMENTS_USE_CASE_PROVIDERS,
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
    findPreferenceReadModel: async (userId): Promise<UserPreferenceReadModel | null> =>
      (await database.query.userPreference.findFirst({ where: { userId: userId.value } })) ?? null,
    listPreferenceReadModelsByUserIds: async (userIds) => {
      if (userIds.length === 0) {
        return [];
      }
      const preferences = await database.query.userPreference.findMany({
        where: { userId: { in: userIds.map((userId) => userId.value) } },
      });
      return preferences.map((preference) => ({
        ...preference,
        userId: UserId.reconstitute(preference.userId),
      }));
    },
    findConsentReadModel: async (userId): Promise<UserConsentReadModel | null> =>
      (await database.query.userConsent.findFirst({ where: { userId: userId.value } })) ?? null,
    listConsentReadModelsByUserIds: async (userIds) => {
      if (userIds.length === 0) {
        return [];
      }
      const consents = await database.query.userConsent.findMany({
        where: { userId: { in: userIds.map((userId) => userId.value) } },
      });
      return consents.map((consent) => ({
        ...consent,
        userId: UserId.reconstitute(consent.userId),
      }));
    },
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
