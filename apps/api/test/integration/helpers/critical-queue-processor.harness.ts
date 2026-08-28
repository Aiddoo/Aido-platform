import { ClsPluginTransactional, TransactionHost } from "@nestjs-cls/transactional";
import { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { type DynamicModule, Module, type Provider } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { FakePushProvider } from "@test/mocks/fake-push.provider";
import { suppressLogger } from "@test/setup/suppress-logger";
import { TestDatabase } from "@test/setup/test-database";
import { ClsModule } from "nestjs-cls";
import { PgBoss } from "pg-boss";

import type { PrismaClient } from "@/generated/prisma/client";
import {
	MARKETING_PUSH_OPT_OUT_TOKEN,
	NOTIFICATION_REPOSITORY,
	PUSH_PROVIDER,
	PUSH_RATE_LIMITER,
} from "@/notification";
import { ACTIVE_PUSH_TOKEN_READER } from "@/notification/application/ports/active-push-token.reader.port";
import { NOTIFICATION_CACHE } from "@/notification/application/ports/notification-cache.port";
import { NOTIFICATION_DEDUP } from "@/notification/application/ports/notification-dedup.port";
import { NOTIFICATION_HISTORY_READER } from "@/notification/application/ports/notification-history.reader.port";
import { NOTIFICATION_INBOX_READER } from "@/notification/application/ports/notification-inbox.reader.port";
import {
	NOTIFICATION_RECIPIENT_LOCALE_READER,
	type NotificationRecipientLocaleReaderPort,
} from "@/notification/application/ports/notification-recipient-locale.reader.port";
import { NOTIFICATION_RECIPIENT_PREFERENCE_READER } from "@/notification/application/ports/notification-recipient-preference.reader.port";
import { PUSH_DISPATCH_REPOSITORY } from "@/notification/application/ports/push-dispatch.repository.port";
import { PUSH_DISPATCHER } from "@/notification/application/ports/push-dispatcher.port";
import { PUSH_RECEIPT_REPOSITORY } from "@/notification/application/ports/push-receipt.repository.port";
import { PUSH_TOKEN_REPOSITORY } from "@/notification/application/ports/push-token.repository.port";
import {
	USER_NOTIFICATION_SETTINGS,
	type UserNotificationSettingsPort,
} from "@/notification/application/ports/user-notification-settings.port";
import { NotificationSender } from "@/notification/application/senders/notification.sender";
import { PushDeliveryEligibilityService } from "@/notification/application/services/push-delivery-eligibility.service";
import { PushNotificationDeliveryService } from "@/notification/application/services/push-notification-delivery.service";
import { PushNotificationPayloadFactory } from "@/notification/application/services/push-notification-payload.factory";
import { DeliverPushNotificationsUseCase } from "@/notification/application/use-cases/deliver-push-notifications/deliver-push-notifications.use-case";
import { DispatchBatchNotificationUseCase } from "@/notification/application/use-cases/dispatch-batch-notification/dispatch-batch-notification.use-case";
import { FindAlreadyNotifiedUsersUseCase } from "@/notification/application/use-cases/find-already-notified-users/find-already-notified-users.use-case";
import { GetNotificationsUseCase } from "@/notification/application/use-cases/get-notifications/get-notifications.use-case";
import { GetUnreadCountUseCase } from "@/notification/application/use-cases/get-unread-count/get-unread-count.use-case";
import { MarkAllAsReadUseCase } from "@/notification/application/use-cases/mark-all-as-read/mark-all-as-read.use-case";
import { MarkAsReadUseCase } from "@/notification/application/use-cases/mark-as-read/mark-as-read.use-case";
import { MarkNotificationOpenedUseCase } from "@/notification/application/use-cases/mark-notification-opened/mark-notification-opened.use-case";
import { OptOutMarketingPushUseCase } from "@/notification/application/use-cases/opt-out-marketing-push/opt-out-marketing-push.use-case";
import { PersistBatchNotificationUseCase } from "@/notification/application/use-cases/persist-batch-notification/persist-batch-notification.use-case";
import { ReconcilePushReceiptsUseCase } from "@/notification/application/use-cases/reconcile-push-receipts/reconcile-push-receipts.use-case";
import { RegisterPushTokenUseCase } from "@/notification/application/use-cases/register-push-token/register-push-token.use-case";
import { SendBatchNotificationUseCase } from "@/notification/application/use-cases/send-batch-notification/send-batch-notification.use-case";
import { SendBillingIssueNotificationUseCase } from "@/notification/application/use-cases/send-billing-issue-notification/send-billing-issue-notification.use-case";
import { SendCheerNotificationUseCase } from "@/notification/application/use-cases/send-cheer-notification/send-cheer-notification.use-case";
import { SendFollowAcceptedNotificationUseCase } from "@/notification/application/use-cases/send-follow-accepted-notification/send-follow-accepted-notification.use-case";
import { SendFollowRequestNotificationUseCase } from "@/notification/application/use-cases/send-follow-request-notification/send-follow-request-notification.use-case";
import { SendFriendCompletionNotificationsUseCase } from "@/notification/application/use-cases/send-friend-completion-notifications/send-friend-completion-notifications.use-case";
import { SendMilestoneNotificationUseCase } from "@/notification/application/use-cases/send-milestone-notification/send-milestone-notification.use-case";
import { SendNotificationWithDedupUseCase } from "@/notification/application/use-cases/send-notification-with-dedup/send-notification-with-dedup.use-case";
import { SendNotificationUseCase } from "@/notification/application/use-cases/send-notification/send-notification.use-case";
import { SendNudgeNotificationUseCase } from "@/notification/application/use-cases/send-nudge-notification/send-nudge-notification.use-case";
import { UnregisterPushTokenUseCase } from "@/notification/application/use-cases/unregister-push-token/unregister-push-token.use-case";
import { CachedActivePushTokenReaderAdapter } from "@/notification/infrastructure/adapters/cached-active-push-token-reader.adapter";
import { CachedNotificationRecipientPreferenceAdapter } from "@/notification/infrastructure/adapters/cached-notification-recipient-preference.adapter";
import { InProcessPushDispatcherAdapter } from "@/notification/infrastructure/adapters/in-process-push-dispatcher.adapter";
import { NotificationCacheAdapter } from "@/notification/infrastructure/adapters/notification-cache.adapter";
import { NotificationDedupAdapter } from "@/notification/infrastructure/adapters/notification-dedup.adapter";
import { PrismaNotificationReader } from "@/notification/infrastructure/persistence/prisma-notification.reader";
import { PrismaNotificationRepository } from "@/notification/infrastructure/persistence/prisma-notification.repository";
import { PrismaPushDeliveryRepository } from "@/notification/infrastructure/persistence/prisma-push-delivery.repository";
import { PrismaPushTokenRepository } from "@/notification/infrastructure/persistence/prisma-push-token.repository";
import { NotificationQueueProcessor } from "@/notification/infrastructure/queue/notification-queue.processor";
import { InMemoryPushRateLimiter } from "@/notification/infrastructure/rate-limiter/in-memory-push-rate-limiter";
import {
	RETENTION_CONFIG,
	type RetentionConfigPort,
} from "@/retention/application/ports/retention-config.port";
import { RETENTION_PUSH_SENDER } from "@/retention/application/ports/retention-push-sender.port";
import { RETENTION_REPOSITORY } from "@/retention/application/ports/retention.repository.port";
import { DispatchRetentionPushUseCase } from "@/retention/application/use-cases/dispatch-retention-push/dispatch-retention-push.use-case";
import { ProcessRetentionStagesUseCase } from "@/retention/application/use-cases/process-retention-stages/process-retention-stages.use-case";
import { RelayRetentionOutboxUseCase } from "@/retention/application/use-cases/relay-retention-outbox/relay-retention-outbox.use-case";
import { ExpoRetentionPushSenderAdapter } from "@/retention/infrastructure/adapters/expo-retention-push-sender.adapter";
import { PrismaRetentionRepository } from "@/retention/infrastructure/persistence/prisma-retention.repository";
import { RetentionQueueProcessor } from "@/retention/infrastructure/queue/retention-queue.processor";
import { JOB_RUNTIME, type JobRuntimePort, UNIT_OF_WORK } from "@/shared/application/ports";
import { InMemoryCacheAdapter } from "@/shared/infrastructure/cache/adapters/in-memory-cache.adapter";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { CACHE_SERVICE } from "@/shared/infrastructure/cache/interfaces/cache.interface";
import { ClsUnitOfWork } from "@/shared/infrastructure/database/cls-unit-of-work";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { InMemoryDedupAdapter } from "@/shared/infrastructure/dedup/adapters/in-memory-dedup.adapter";
import { DEDUP_PROVIDER } from "@/shared/infrastructure/dedup/interfaces/dedup.interface";
import { PgBossJobRuntimeAdapter } from "@/shared/infrastructure/jobs/pg-boss-job-runtime.adapter";
import type {
	UserConsentRecord,
	UserConsentRecordWithId,
	UserPreferenceRecord,
	UserPreferenceRecordWithId,
} from "@/user-settings";

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
	static register(prisma: PrismaClient): DynamicModule {
		return {
			module: CriticalQueueDatabaseModule,
			providers: [{ provide: DatabaseService, useValue: prisma }],
			exports: [DatabaseService],
		};
	}
}

export interface CriticalQueueProcessorHarness {
	readonly prisma: PrismaClient;
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
						adapter: new TransactionalAdapterPrisma<DatabaseService>({
							prismaInjectionToken: DatabaseService,
						}),
					}),
				],
			}),
		],
		providers: [
			ClsUnitOfWork,
			{ provide: UNIT_OF_WORK, useExisting: ClsUnitOfWork },
			{
				provide: JOB_RUNTIME,
				inject: [TransactionHost],
				useFactory: (txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>) =>
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
		SendFriendCompletionNotificationsUseCase,
		{ provide: SendFollowRequestNotificationUseCase, useValue: unexpectedUseCase },
		{ provide: SendFollowAcceptedNotificationUseCase, useValue: unexpectedUseCase },
		{ provide: SendNudgeNotificationUseCase, useValue: unexpectedUseCase },
		{ provide: SendCheerNotificationUseCase, useValue: unexpectedUseCase },
		{ provide: SendBillingIssueNotificationUseCase, useValue: unexpectedUseCase },
		{ provide: SendMilestoneNotificationUseCase, useValue: unexpectedUseCase },
		{ provide: ReconcilePushReceiptsUseCase, useValue: unexpectedUseCase },
		{
			provide: NotificationSender,
			inject: [
				SendNotificationUseCase,
				SendNotificationWithDedupUseCase,
				SendBatchNotificationUseCase,
				FindAlreadyNotifiedUsersUseCase,
				NOTIFICATION_RECIPIENT_LOCALE_READER,
			],
			useFactory: (
				sendNotification: SendNotificationUseCase,
				sendWithDedup: SendNotificationWithDedupUseCase,
				sendBatch: SendBatchNotificationUseCase,
				findAlreadyNotified: FindAlreadyNotifiedUsersUseCase,
				recipientLocaleReader: NotificationRecipientLocaleReaderPort,
			) =>
				new NotificationSender(
					sendNotification,
					sendWithDedup,
					sendBatch,
					findAlreadyNotified,
					recipientLocaleReader,
				),
		},
		PersistBatchNotificationUseCase,
		DispatchBatchNotificationUseCase,
		FindAlreadyNotifiedUsersUseCase,
		{
			provide: GetNotificationsUseCase,
			useValue: unexpectedUseCase,
		},
		{ provide: GetUnreadCountUseCase, useValue: unexpectedUseCase },
		{ provide: MarkAsReadUseCase, useValue: unexpectedUseCase },
		{ provide: MarkNotificationOpenedUseCase, useValue: unexpectedUseCase },
		{ provide: MarkAllAsReadUseCase, useValue: unexpectedUseCase },
		{ provide: RegisterPushTokenUseCase, useValue: unexpectedUseCase },
		{ provide: UnregisterPushTokenUseCase, useValue: unexpectedUseCase },
		{ provide: OptOutMarketingPushUseCase, useValue: unexpectedUseCase },
		{ provide: SendNotificationUseCase, useValue: unexpectedUseCase },
		{ provide: SendNotificationWithDedupUseCase, useValue: unexpectedUseCase },
		{ provide: SendBatchNotificationUseCase, useValue: unexpectedUseCase },
		PrismaNotificationRepository,
		{ provide: NOTIFICATION_REPOSITORY, useExisting: PrismaNotificationRepository },
		PrismaNotificationReader,
		{ provide: NOTIFICATION_INBOX_READER, useExisting: PrismaNotificationReader },
		{ provide: NOTIFICATION_HISTORY_READER, useExisting: PrismaNotificationReader },
		PrismaPushTokenRepository,
		{ provide: PUSH_TOKEN_REPOSITORY, useExisting: PrismaPushTokenRepository },
		PrismaPushDeliveryRepository,
		{ provide: PUSH_DISPATCH_REPOSITORY, useExisting: PrismaPushDeliveryRepository },
		{ provide: PUSH_RECEIPT_REPOSITORY, useExisting: PrismaPushDeliveryRepository },
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
		CachedNotificationRecipientPreferenceAdapter,
		{
			provide: NOTIFICATION_RECIPIENT_PREFERENCE_READER,
			useExisting: CachedNotificationRecipientPreferenceAdapter,
		},
		{
			provide: NOTIFICATION_RECIPIENT_LOCALE_READER,
			useExisting: CachedNotificationRecipientPreferenceAdapter,
		},
		PushDeliveryEligibilityService,
		PushNotificationDeliveryService,
		PushNotificationPayloadFactory,
		DeliverPushNotificationsUseCase,
		InProcessPushDispatcherAdapter,
		{ provide: PUSH_DISPATCHER, useExisting: InProcessPushDispatcherAdapter },
	];
}

function retentionProviders(): Provider[] {
	const config: RetentionConfigPort = {
		enabled: true,
		treatmentPercent: 100,
	};
	return [
		RetentionQueueProcessor,
		DispatchRetentionPushUseCase,
		{
			provide: ProcessRetentionStagesUseCase,
			useValue: unexpectedUseCase,
		},
		{ provide: RelayRetentionOutboxUseCase, useValue: unexpectedUseCase },
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
			await database.userPreference.upsert({
				where: { userId },
				create: { userId, timezone },
				update: { timezone },
			});
		},
		upsertPushLocale: async (userId, locale) => {
			await database.userPreference.upsert({
				where: { userId },
				create: { userId, locale },
				update: { locale },
			});
		},
		getPreferenceRecord: async (userId): Promise<UserPreferenceRecord | null> =>
			database.userPreference.findUnique({ where: { userId } }),
		getPreferenceRecordsByUserIds: async (userIds): Promise<UserPreferenceRecordWithId[]> =>
			database.userPreference.findMany({
				where: { userId: { in: userIds } },
			}),
		getConsentRecord: async (userId): Promise<UserConsentRecord | null> =>
			database.userConsent.findUnique({ where: { userId } }),
		getConsentRecordsByUserIds: async (userIds): Promise<UserConsentRecordWithId[]> =>
			database.userConsent.findMany({
				where: { userId: { in: userIds } },
			}),
		updateMarketingPushConsent: async (userId, agreed) => {
			await database.userConsent.upsert({
				where: { userId },
				create: {
					userId,
					marketingPushAgreedAt: agreed ? new Date() : null,
				},
				update: {
					marketingPushAgreedAt: agreed ? new Date() : null,
				},
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
		if (hour >= 9 && hour < 20) return timezone;
	}
	throw new Error("No daytime IANA timezone available for retention test");
}
