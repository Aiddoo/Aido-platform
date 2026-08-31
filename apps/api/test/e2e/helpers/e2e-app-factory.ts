/**
 * E2E 테스트 앱 팩토리
 *
 * @description
 * 모든 E2E 테스트에서 반복되는 NestJS 앱 초기화 보일러플레이트를 통합합니다.
 * - TestDatabase (Testcontainers)
 * - 외부 서비스 Fake 처리 (Email, OAuth, Push, AI, Discord, Weather)
 * - ZodValidationPipe
 * - PinoLogger 억제
 */

import type { INestApplication } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test, type TestingModule } from "@nestjs/testing";
import RedisMock from "ioredis-mock";
import { PinoLogger } from "nestjs-pino";
import type { App } from "supertest/types";

import { ADMIN_NOTIFIER, PAYMENT_NOTIFIER } from "@/admin-notification";
import { AdminNotificationProcessor } from "@/admin-notification/infrastructure/queue/admin-notification-queue.processor";
import { DailySignupSummaryScheduler } from "@/admin-notification/infrastructure/scheduler/daily-signup-summary.scheduler";
import { AI_PROVIDER } from "@/ai";
import { ReportGenerationJob } from "@/ai-report/infrastructure/jobs/report-generation.job";
import { ReportGenerationProcessor } from "@/ai-report/infrastructure/processors/report-generation.processor";
import { SuggestionAnalysisJob } from "@/ai-suggestion/infrastructure/jobs/suggestion-analysis.job";
import { SuggestionAnalysisProcessor } from "@/ai-suggestion/infrastructure/processors/suggestion-analysis.processor";
import { AppModule } from "@/app.module";
import { OAUTH_IDENTITY_PROVIDER_REGISTRY } from "@/auth/application/ports/oauth-identity-provider.port";
import { createOAuthProviderRegistry } from "@/auth/infrastructure/oauth/adapters";
import { OAuthTokenVerifierService } from "@/auth/infrastructure/oauth/verifier/oauth-token-verifier.service";
import { AccountPurgeProcessor } from "@/auth/infrastructure/queue/account-purge.processor";
import { AccountPurgeJob } from "@/auth/infrastructure/scheduler/account-purge.job";
import { TransactionalEmailSender } from "@/email";
import { PUSH_PROVIDER } from "@/notification";
import { NotificationQueueProcessor } from "@/notification/infrastructure/queue/notification-queue.processor";
import { RetentionQueueProcessor } from "@/retention/infrastructure/queue/retention-queue.processor";
import { RetentionQueueService } from "@/retention/infrastructure/queue/retention-queue.service";
import {
	TimezoneAwareReminderOrchestrator,
	TimezoneReminderProcessor,
	TodoReminderProcessor,
} from "@/scheduler";
import { DOMAIN_EVENT_PUBLISHER, JOB_RUNTIME } from "@/shared/application/ports";
import { InMemoryCacheAdapter } from "@/shared/infrastructure/cache/adapters/in-memory-cache.adapter";
import { CACHE_SERVICE } from "@/shared/infrastructure/cache/interfaces/cache.interface";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";
import { DatabaseService } from "@/shared/infrastructure/database";
import { configureApplication } from "@/shared/infrastructure/http/configure-application";
import { REDIS_CLIENT, REDIS_COMMAND_CLIENT } from "@/shared/infrastructure/redis/redis.constants";
import { AIR_QUALITY_PROVIDER } from "@/weather/application/ports/air-quality-provider.port";
import { LIFESTYLE_INDEX_PROVIDER } from "@/weather/application/ports/lifestyle-index-provider.port";
import { SUN_TIME_PROVIDER } from "@/weather/application/ports/sun-time-provider.port";
import { WEATHER_PROVIDER } from "@/weather/application/ports/weather-provider.port";

import { FakeAdminNotifier } from "../../mocks/fake-admin-notifier";
import { FakeAiProvider } from "../../mocks/fake-ai.provider";
import { FakeAirQualityProvider } from "../../mocks/fake-air-quality.provider";
import { FakeEmailService } from "../../mocks/fake-email.service";
import { FakeJobRuntime } from "../../mocks/fake-job-runtime";
import { FakeLifestyleIndexProvider } from "../../mocks/fake-lifestyle-index.provider";
import { FakeLogger } from "../../mocks/fake-logger.service";
import { FakeOAuthProviderRegistry } from "../../mocks/fake-oauth-provider-registry";
import { FakeOAuthTokenVerifierService } from "../../mocks/fake-oauth-token-verifier.service";
import { FakePushProvider } from "../../mocks/fake-push.provider";
import { FakeSunTimeProvider } from "../../mocks/fake-sun-time.provider";
import { FakeWeatherProvider } from "../../mocks/fake-weather.provider";
import { TestDatabase } from "../../setup/test-database";
import { E2eHelpers } from "./e2e-helpers";
import { createE2eTestStateResetter, type TestStateResetter } from "./e2e-test-state";
import { bypassE2eThrottler, restoreRealE2eThrottler } from "./e2e-throttler-control";
import { TrackingDomainEventPublisher } from "./tracking-domain-event-publisher";

/* ── 백그라운드 작업 격리 대상 ────────────────────────── */

const BACKGROUND_PROCESSORS = [
	AdminNotificationProcessor,
	TimezoneReminderProcessor,
	TodoReminderProcessor,
	SuggestionAnalysisProcessor,
	ReportGenerationProcessor,
	AccountPurgeProcessor,
	NotificationQueueProcessor,
	RetentionQueueProcessor,
];

const BACKGROUND_JOBS = [
	DailySignupSummaryScheduler,
	TimezoneAwareReminderOrchestrator,
	SuggestionAnalysisJob,
	ReportGenerationJob,
	AccountPurgeJob,
	RetentionQueueService,
];

export interface E2eTestContext {
	app: INestApplication<App>;
	module: TestingModule;
	testDatabase: TestDatabase;
	fakeEmailService: FakeEmailService;
	fakeOAuthTokenVerifierService: FakeOAuthTokenVerifierService;
	fakeOAuthProviderRegistry: FakeOAuthProviderRegistry;
	helpers: E2eHelpers;
	reset(): Promise<void>;
	/** @internal restartE2eAppPreservingDatabase 전용 */
	closeApplicationResources(): Promise<void>;
	/** @internal destroyE2eApp 전용 */
	closeTestResources(): Promise<void>;
}

export interface E2eAppOptions {
	/** 전역 E2E bypass를 해제하고 실제 ThrottlerGuard를 검증하는 전용 suite용 */
	withRealThrottler?: boolean;
	/** 추가 provider override 콜백 */
	customizeBuilder?: (
		builder: ReturnType<typeof Test.createTestingModule>,
	) => ReturnType<typeof Test.createTestingModule>;
	/** suite에서 추가로 override한 fake의 상태 초기화 함수 */
	additionalResetters?: readonly TestStateResetter[];
	/** @internal 앱 재시작 테스트에서 동일 PostgreSQL을 재사용 */
	testDatabase?: TestDatabase;
}

export async function createE2eApp(options?: E2eAppOptions): Promise<E2eTestContext> {
	const withRealThrottler = options?.withRealThrottler === true;
	if (withRealThrottler) {
		restoreRealE2eThrottler();
	}

	let contextOwnsThrottlerLifecycle = false;
	try {
		const context = await createE2eAppContext(options);
		contextOwnsThrottlerLifecycle = true;
		return context;
	} finally {
		if (withRealThrottler && !contextOwnsThrottlerLifecycle) {
			bypassE2eThrottler();
		}
	}
}

async function createE2eAppContext(options?: E2eAppOptions): Promise<E2eTestContext> {
	const testDatabase = options?.testDatabase ?? new TestDatabase();
	if (!options?.testDatabase) {
		await testDatabase.start();
	}

	const fakeEmailService = new FakeEmailService();
	const fakeOAuthTokenVerifierService = new FakeOAuthTokenVerifierService();
	const fakeAdminNotifier = new FakeAdminNotifier();
	const fakePaymentNotifier = new FakeAdminNotifier();
	const fakePushProvider = new FakePushProvider();
	const fakeAiProvider = new FakeAiProvider();
	const fakeWeatherProvider = new FakeWeatherProvider();
	const fakeAirQualityProvider = new FakeAirQualityProvider();
	const fakeLifestyleIndexProvider = new FakeLifestyleIndexProvider();
	const fakeSunTimeProvider = new FakeSunTimeProvider();
	const fakeJobRuntime = new FakeJobRuntime();

	const redisMock = new RedisMock();
	const cacheAdapter = new InMemoryCacheAdapter({
		defaultTtlMs: 60000,
		maxItems: 1000,
		cleanupIntervalMs: 30000,
	});
	let fakeOAuthProviderRegistry: FakeOAuthProviderRegistry | undefined;
	let trackingEventPublisher: TrackingDomainEventPublisher | undefined;
	let module: TestingModule | undefined;
	let app: INestApplication<App> | undefined;
	let applicationClosed = false;

	const closeApplicationResources = async (): Promise<void> => {
		if (applicationClosed) {
			return;
		}
		applicationClosed = true;
		const errors: unknown[] = [];
		try {
			try {
				await app?.close();
			} catch (error) {
				errors.push(error);
			}

			const results = await Promise.allSettled([
				Promise.resolve().then(() => redisMock.disconnect()),
				Promise.resolve().then(() => cacheAdapter.onModuleDestroy()),
			]);
			errors.push(
				...results.flatMap((result) => (result.status === "rejected" ? [result.reason] : [])),
			);
			if (errors.length > 0) {
				throw new AggregateError(errors, "Failed to close E2E app resources");
			}
		} finally {
			if (options?.withRealThrottler) {
				bypassE2eThrottler();
			}
		}
	};

	const closeTestResources = async (): Promise<void> => {
		const results = await Promise.allSettled([closeApplicationResources(), testDatabase.stop()]);
		const errors = results.flatMap((result) =>
			result.status === "rejected" ? [result.reason] : [],
		);
		if (errors.length > 0) {
			throw new AggregateError(errors, "Failed to close E2E test resources");
		}
	};

	let builder = Test.createTestingModule({
		imports: [AppModule],
	})
		.overrideProvider(REDIS_CLIENT)
		.useValue(redisMock)
		.overrideProvider(REDIS_COMMAND_CLIENT)
		.useValue(redisMock)
		.overrideProvider(JOB_RUNTIME)
		.useValue(fakeJobRuntime)
		.overrideProvider(CACHE_SERVICE)
		.useValue(cacheAdapter)
		.overrideProvider(DatabaseService)
		.useValue(testDatabase.getPrisma())
		.overrideProvider(TransactionalEmailSender)
		.useValue(fakeEmailService)
		.overrideProvider(OAuthTokenVerifierService)
		.useValue(fakeOAuthTokenVerifierService)
		.overrideProvider(OAUTH_IDENTITY_PROVIDER_REGISTRY)
		.useFactory({
			inject: [TypedConfigService],
			factory: (configService: TypedConfigService) => {
				const delegates = createOAuthProviderRegistry(configService, fakeOAuthTokenVerifierService);
				fakeOAuthProviderRegistry = new FakeOAuthProviderRegistry(delegates);
				return fakeOAuthProviderRegistry.registry;
			},
		})
		.overrideProvider(ADMIN_NOTIFIER)
		.useValue(fakeAdminNotifier)
		.overrideProvider(PAYMENT_NOTIFIER)
		.useValue(fakePaymentNotifier)
		.overrideProvider(PUSH_PROVIDER)
		.useValue(fakePushProvider)
		.overrideProvider(AI_PROVIDER)
		.useValue(fakeAiProvider)
		.overrideProvider(WEATHER_PROVIDER)
		.useValue(fakeWeatherProvider)
		.overrideProvider(AIR_QUALITY_PROVIDER)
		.useValue(fakeAirQualityProvider)
		.overrideProvider(LIFESTYLE_INDEX_PROVIDER)
		.useValue(fakeLifestyleIndexProvider)
		.overrideProvider(SUN_TIME_PROVIDER)
		.useValue(fakeSunTimeProvider)
		.overrideProvider(PinoLogger)
		.useClass(FakeLogger)
		// 도메인 이벤트 리스너의 잔류 작업을 reset이 drain할 수 있도록 추적 퍼블리셔로 교체
		.overrideProvider(DOMAIN_EVENT_PUBLISHER)
		.useFactory({
			inject: [EventEmitter2],
			factory: (eventEmitter: EventEmitter2) => {
				trackingEventPublisher = new TrackingDomainEventPublisher(eventEmitter);
				return trackingEventPublisher;
			},
		});

	// Processor → no-op (E2E 앱에서 실제 worker 실행 차단)
	for (const processor of BACKGROUND_PROCESSORS) {
		builder = builder.overrideProvider(processor).useValue({});
	}

	// Job/Scheduler → no-op (E2E 앱에서 onModuleInit 실행 차단)
	for (const job of BACKGROUND_JOBS) {
		builder = builder.overrideProvider(job).useValue({});
	}

	if (options?.customizeBuilder) {
		builder = options.customizeBuilder(builder);
	}

	try {
		module = await builder.compile();
		app = module.createNestApplication();
		configureApplication(app, {
			nodeEnv: "development",
			corsOrigins: ["http://localhost:3000"],
			enableShutdownHooks: false,
		});
		await app.init();

		if (!fakeOAuthProviderRegistry) {
			throw new Error("Fake OAuth provider registry was not initialized");
		}

		const helpers = new E2eHelpers(app, fakeEmailService);
		const reset = createE2eTestStateResetter({
			drainBackgroundWork: async () => {
				// commit 뒤 이벤트 작업이 정착한 후 DB를 정리한다. Push는 durable queue가 소유한다.
				await trackingEventPublisher?.drainPendingEvents();
			},
			cleanupDatabase: () => testDatabase.cleanup(),
			resetCache: () => cacheAdapter.reset(),
			flushRedis: () => redisMock.flushall(),
			sharedResetters: [
				() => fakeEmailService.clear(),
				() => fakeOAuthTokenVerifierService.clear(),
				() => fakeOAuthProviderRegistry?.clear(),
				() => fakeAdminNotifier.clear(),
				() => fakePaymentNotifier.clear(),
				() => fakePushProvider.clear(),
				() => fakeAiProvider.clear(),
				() => fakeWeatherProvider.clear(),
				() => fakeAirQualityProvider.clear(),
				() => fakeLifestyleIndexProvider.clear(),
				() => fakeSunTimeProvider.clear(),
				() => fakeJobRuntime.clear(),
			],
			additionalResetters: options?.additionalResetters,
		});

		return {
			app,
			module,
			testDatabase,
			fakeEmailService,
			fakeOAuthTokenVerifierService,
			fakeOAuthProviderRegistry,
			helpers,
			reset,
			closeApplicationResources,
			closeTestResources,
		};
	} catch (error) {
		await closeTestResources();
		throw error;
	}
}

export async function destroyE2eApp(ctx: E2eTestContext): Promise<void> {
	await ctx.closeTestResources();
}

export async function restartE2eAppPreservingDatabase(
	ctx: E2eTestContext,
): Promise<E2eTestContext> {
	await ctx.closeApplicationResources();
	return createE2eApp({ testDatabase: ctx.testDatabase });
}
