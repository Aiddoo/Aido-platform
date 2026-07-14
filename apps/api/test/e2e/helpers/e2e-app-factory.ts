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

import { getQueueToken } from "@nestjs/bullmq";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import RedisMock from "ioredis-mock";
import { PinoLogger } from "nestjs-pino";
import { ZodValidationPipe } from "nestjs-zod";
import type { App } from "supertest/types";
import {
	ADMIN_NOTIFICATION_QUEUE,
	ADMIN_NOTIFIER,
	PAYMENT_NOTIFIER,
} from "@/admin-notification";
import { AdminNotificationProcessor } from "@/admin-notification/infrastructure/queue/admin-notification-queue.processor";
import { DailySignupSummaryScheduler } from "@/admin-notification/infrastructure/scheduler/daily-signup-summary.scheduler";
import { AI_PROVIDER } from "@/ai";
import { AI_REPORT_QUEUE } from "@/ai-report";
import { ReportGenerationJob } from "@/ai-report/infrastructure/jobs/report-generation.job";
import { ReportGenerationProcessor } from "@/ai-report/infrastructure/processors/report-generation.processor";
import { AI_SUGGESTION_QUEUE } from "@/ai-suggestion";
import { SuggestionAnalysisJob } from "@/ai-suggestion/infrastructure/jobs/suggestion-analysis.job";
import { SuggestionAnalysisProcessor } from "@/ai-suggestion/infrastructure/processors/suggestion-analysis.processor";
import { AppModule } from "@/app.module";
import { OAuthTokenVerifierService } from "@/auth/infrastructure/oauth/verifier/oauth-token-verifier.service";
import {
	ACCOUNT_PURGE_QUEUE,
	AccountPurgeProcessor,
} from "@/auth/infrastructure/queue/account-purge.processor";
import { AccountPurgeJob } from "@/auth/infrastructure/scheduler/account-purge.job";
import { EmailFacade } from "@/email";
import {
	NOTIFICATION_QUEUE,
	NotificationQueueProcessor,
	PUSH_PROVIDER,
} from "@/notification";
import { RETENTION_QUEUE } from "@/retention/infrastructure/queue/retention-queue.constants";
import { RetentionQueueProcessor } from "@/retention/infrastructure/queue/retention-queue.processor";
import { RetentionQueueService } from "@/retention/infrastructure/queue/retention-queue.service";
import {
	TIMEZONE_REMINDER_QUEUE,
	TimezoneAwareReminderOrchestrator,
	TimezoneReminderProcessor,
	TODO_REMINDER_QUEUE,
	TodoReminderProcessor,
} from "@/scheduler";
import { InMemoryCacheAdapter } from "@/shared/infrastructure/cache/adapters/in-memory-cache.adapter";
import { CACHE_SERVICE } from "@/shared/infrastructure/cache/interfaces/cache.interface";
import { DatabaseService } from "@/shared/infrastructure/database";
import {
	REDIS_CLIENT,
	REDIS_COMMAND_CLIENT,
} from "@/shared/infrastructure/redis/redis.constants";
import { AIR_QUALITY_PROVIDER } from "@/weather/application/ports/air-quality-provider.port";
import { LIFESTYLE_INDEX_PROVIDER } from "@/weather/application/ports/lifestyle-index-provider.port";
import { SUN_TIME_PROVIDER } from "@/weather/application/ports/sun-time-provider.port";
import { WEATHER_PROVIDER } from "@/weather/application/ports/weather-provider.port";
import { FakeAdminNotifier } from "../../mocks/fake-admin-notifier";
import { FakeAiProvider } from "../../mocks/fake-ai.provider";
import { FakeAirQualityProvider } from "../../mocks/fake-air-quality.provider";
import { createMockBullQueue } from "../../mocks/fake-bull-queue";
import { FakeEmailService } from "../../mocks/fake-email.service";
import { FakeLifestyleIndexProvider } from "../../mocks/fake-lifestyle-index.provider";
import { FakeLogger } from "../../mocks/fake-logger.service";
import { FakeOAuthTokenVerifierService } from "../../mocks/fake-oauth-token-verifier.service";
import { FakePushProvider } from "../../mocks/fake-push.provider";
import { FakeSunTimeProvider } from "../../mocks/fake-sun-time.provider";
import { FakeWeatherProvider } from "../../mocks/fake-weather.provider";
import { TestDatabase } from "../../setup/test-database";
import { E2eHelpers } from "./e2e-helpers";

/* ── BullMQ 격리 대상 ─────────────────────────────────── */

const BULL_QUEUES = [
	ADMIN_NOTIFICATION_QUEUE,
	TIMEZONE_REMINDER_QUEUE,
	TODO_REMINDER_QUEUE,
	AI_SUGGESTION_QUEUE,
	AI_REPORT_QUEUE,
	ACCOUNT_PURGE_QUEUE,
	NOTIFICATION_QUEUE,
	RETENTION_QUEUE,
];

const BULL_PROCESSORS = [
	AdminNotificationProcessor,
	TimezoneReminderProcessor,
	TodoReminderProcessor,
	SuggestionAnalysisProcessor,
	ReportGenerationProcessor,
	AccountPurgeProcessor,
	NotificationQueueProcessor,
	RetentionQueueProcessor,
];

const BULL_JOBS = [
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
	helpers: E2eHelpers;
}

export interface E2eAppOptions {
	/** 추가 provider override 콜백 */
	customizeBuilder?: (
		builder: ReturnType<typeof Test.createTestingModule>,
	) => ReturnType<typeof Test.createTestingModule>;
}

export async function createE2eApp(
	options?: E2eAppOptions,
): Promise<E2eTestContext> {
	const testDatabase = new TestDatabase();
	await testDatabase.start();

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

	const redisMock = new RedisMock();

	let builder = Test.createTestingModule({
		imports: [AppModule],
	})
		.overrideProvider(REDIS_CLIENT)
		.useValue(redisMock)
		.overrideProvider(REDIS_COMMAND_CLIENT)
		.useValue(redisMock)
		.overrideProvider(CACHE_SERVICE)
		.useValue(
			new InMemoryCacheAdapter({
				defaultTtlMs: 60000,
				maxItems: 1000,
				cleanupIntervalMs: 30000,
			}),
		)
		.overrideProvider(DatabaseService)
		.useValue(testDatabase.getPrisma())
		.overrideProvider(EmailFacade)
		.useValue(fakeEmailService)
		.overrideProvider(OAuthTokenVerifierService)
		.useValue(fakeOAuthTokenVerifierService)
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
		.useClass(FakeLogger);

	// BullMQ 격리: Queue 토큰 → mock queue
	for (const queueName of BULL_QUEUES) {
		builder = builder
			.overrideProvider(getQueueToken(queueName))
			.useValue(createMockBullQueue());
	}

	// BullMQ 격리: Processor → no-op (Worker 생성 차단)
	for (const processor of BULL_PROCESSORS) {
		builder = builder.overrideProvider(processor).useValue({});
	}

	// BullMQ 격리: Job/Scheduler → no-op (onModuleInit 차단)
	for (const job of BULL_JOBS) {
		builder = builder.overrideProvider(job).useValue({});
	}

	if (options?.customizeBuilder) {
		builder = options.customizeBuilder(builder);
	}

	const module = await builder.compile();

	const app = module.createNestApplication();
	app.useGlobalPipes(new ZodValidationPipe());
	await app.init();

	const helpers = new E2eHelpers(app, fakeEmailService);

	return {
		app,
		module,
		testDatabase,
		fakeEmailService,
		fakeOAuthTokenVerifierService,
		helpers,
	};
}

export async function destroyE2eApp(ctx: E2eTestContext): Promise<void> {
	await ctx.app.close();
	await ctx.testDatabase.stop();
}
