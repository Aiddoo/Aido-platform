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
import { DailySignupSummaryJob } from "@/admin-notification/jobs/daily-signup-summary.job";
import {
	ADMIN_NOTIFIER,
	PAYMENT_NOTIFIER,
} from "@/admin-notification/providers/admin-notifier.interface";
import { ADMIN_NOTIFICATION_QUEUE } from "@/admin-notification/queue/admin-notification-queue.constants";
import { AdminNotificationProcessor } from "@/admin-notification/queue/admin-notification-queue.processor";
import { AI_PROVIDER } from "@/ai/providers/ai.provider";
import { ReportGenerationJob } from "@/ai-report/jobs/report-generation.job";
import {
	AI_REPORT_QUEUE,
	ReportGenerationProcessor,
} from "@/ai-report/processors/report-generation.processor";
import { SuggestionAnalysisJob } from "@/ai-suggestion/jobs/suggestion-analysis.job";
import {
	AI_SUGGESTION_QUEUE,
	SuggestionAnalysisProcessor,
} from "@/ai-suggestion/processors/suggestion-analysis.processor";
import { AppModule } from "@/app.module";
import { AccountPurgeJob } from "@/auth/jobs/account-purge.job";
import {
	ACCOUNT_PURGE_QUEUE,
	AccountPurgeProcessor,
} from "@/auth/processors/account-purge.processor";
import { OAuthTokenVerifierService } from "@/auth/services/oauth-token-verifier.service";
import { EmailService } from "@/email/email.service";
import { PUSH_PROVIDER } from "@/notification/providers/push-provider.interface";
import { NOTIFICATION_QUEUE } from "@/notification/queue/notification-queue.constants";
import { NotificationQueueProcessor } from "@/notification/queue/notification-queue.processor";
import { TimezoneAwareReminderJob } from "@/scheduler/jobs/timezone-aware-reminder.job";
import { TIMEZONE_REMINDER_QUEUE } from "@/scheduler/queue/timezone-reminder-queue.constants";
import { TimezoneReminderProcessor } from "@/scheduler/queue/timezone-reminder-queue.processor";
import { TODO_REMINDER_QUEUE } from "@/scheduler/reminder/adapters/bullmq-reminder-scheduler.adapter";
import { TodoReminderProcessor } from "@/scheduler/reminder/processors/todo-reminder.processor";
import { InMemoryCacheAdapter } from "@/shared/infrastructure/cache/adapters/in-memory-cache.adapter";
import { CACHE_SERVICE } from "@/shared/infrastructure/cache/interfaces/cache.interface";
import { DatabaseService } from "@/shared/infrastructure/database";
import {
	REDIS_CLIENT,
	REDIS_COMMAND_CLIENT,
} from "@/shared/infrastructure/redis/redis.constants";
import { AIR_QUALITY_PROVIDER } from "@/weather/providers/air/air-quality.types";
import { LIFESTYLE_INDEX_PROVIDER } from "@/weather/providers/lifestyle/lifestyle-index.types";
import { SUN_TIME_PROVIDER } from "@/weather/providers/sun/sun-time.types";
import { WEATHER_PROVIDER } from "@/weather/providers/weather-provider.interface";
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
];

const BULL_PROCESSORS = [
	AdminNotificationProcessor,
	TimezoneReminderProcessor,
	TodoReminderProcessor,
	SuggestionAnalysisProcessor,
	ReportGenerationProcessor,
	AccountPurgeProcessor,
	NotificationQueueProcessor,
];

const BULL_JOBS = [
	DailySignupSummaryJob,
	TimezoneAwareReminderJob,
	SuggestionAnalysisJob,
	ReportGenerationJob,
	AccountPurgeJob,
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
		.overrideProvider(EmailService)
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
