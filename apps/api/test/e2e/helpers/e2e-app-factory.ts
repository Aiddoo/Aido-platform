import type { INestApplication } from "@nestjs/common";
/**
 * E2E 테스트 앱 팩토리
 *
 * @description
 * 모든 E2E 테스트에서 반복되는 NestJS 앱 초기화 보일러플레이트를 통합합니다.
 * - TestDatabase (Testcontainers)
 * - 외부 서비스 Fake 처리 (Email, OAuth, Push, AI, Discord, Weather)
 * - Native StandardSchemaValidationPipe
 * - PinoLogger 억제
 */
import { EventEmitter2 } from "@nestjs/event-emitter";
import { HttpClient } from "@nestjs/http-client";
import { Test, type TestingModule } from "@nestjs/testing";
import { ThrottlerGuard } from "@nestjs/throttler";
import RedisMock from "ioredis-mock";
import { PinoLogger } from "nestjs-pino";
import type { App } from "supertest/types.js";

import { AppModule } from "#api/app.module";
import { AI_PROVIDER } from "#api/modules/ai-assistance/ai-assistance-parsing.public";
import { ReportGenerationJob } from "#api/modules/ai-assistance/infrastructure/jobs/reports/report-generation.job";
import { SuggestionAnalysisJob } from "#api/modules/ai-assistance/infrastructure/jobs/suggestions/suggestion-analysis.job";
import { ReportGenerationProcessor } from "#api/modules/ai-assistance/infrastructure/processors/reports/report-generation.processor";
import { SuggestionAnalysisProcessor } from "#api/modules/ai-assistance/infrastructure/processors/suggestions/suggestion-analysis.processor";
import { OAUTH_IDENTITY_PROVIDER_REGISTRY } from "#api/modules/identity/application/ports/auth/oauth-identity-provider.port";
import { AccountPurgeJob } from "#api/modules/identity/infrastructure/jobs/auth/account-purge.job";
import { AccountPurgeProcessor } from "#api/modules/identity/infrastructure/jobs/auth/account-purge.processor";
import { createOAuthProviderRegistry } from "#api/modules/identity/infrastructure/oauth/auth/adapters/index";
import { OAuthTokenVerifierService } from "#api/modules/identity/infrastructure/oauth/auth/verifier/oauth-token-verifier.service";
import { NotificationQueueProcessor } from "#api/modules/notification/infrastructure/jobs/delivery/notification-queue.processor";
import { RetentionQueueProcessor } from "#api/modules/notification/infrastructure/jobs/retention/retention-queue.processor";
import { RetentionQueueService } from "#api/modules/notification/infrastructure/jobs/retention/retention-queue.service";
import { PUSH_PROVIDER } from "#api/modules/notification/notification-delivery.public";
import { TransactionalEmailSender } from "#api/modules/notification/notification-email.public";
import {
  TimezoneAwareReminderOrchestrator,
  TimezoneReminderProcessor,
  TodoReminderProcessor,
} from "#api/modules/notification/notification-reminders.public";
import { AdminNotificationProcessor } from "#api/modules/operations/infrastructure/jobs/notifications/admin-notification-queue.processor";
import { DailySignupSummaryScheduler } from "#api/modules/operations/infrastructure/jobs/notifications/daily-signup-summary.scheduler";
import {
  ADMIN_NOTIFIER,
  PAYMENT_NOTIFIER,
} from "#api/modules/operations/operations-notifications.public";
import { AIR_QUALITY_PROVIDER } from "#api/modules/weather/application/ports/forecast/air-quality-provider.port";
import { LIFESTYLE_INDEX_PROVIDER } from "#api/modules/weather/application/ports/forecast/lifestyle-index-provider.port";
import { SUN_TIME_PROVIDER } from "#api/modules/weather/application/ports/forecast/sun-time-provider.port";
import { WEATHER_PROVIDER } from "#api/modules/weather/application/ports/forecast/weather-provider.port";
import { InMemoryCacheAdapter } from "#api/platform/cache/adapters/in-memory-cache.adapter";
import { CACHE_SERVICE } from "#api/platform/cache/interfaces/cache.interface";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { DatabaseService } from "#api/platform/database/index";
import { configureApplication } from "#api/platform/http/configure-application";
import { REDIS_CLIENT, REDIS_COMMAND_CLIENT } from "#api/platform/redis/redis.constants";
import { DOMAIN_EVENT_PUBLISHER, JOB_RUNTIME } from "#api/shared/application/ports/index";

import { FakeAdminNotifier } from "../../mocks/fake-admin-notifier.js";
import { FakeAiProvider } from "../../mocks/fake-ai.provider.js";
import { FakeAirQualityProvider } from "../../mocks/fake-air-quality.provider.js";
import { FakeEmailService } from "../../mocks/fake-email.service.js";
import { FakeJobRuntime } from "../../mocks/fake-job-runtime.js";
import { FakeLifestyleIndexProvider } from "../../mocks/fake-lifestyle-index.provider.js";
import { FakeLogger } from "../../mocks/fake-logger.service.js";
import { FakeOAuthProviderRegistry } from "../../mocks/fake-oauth-provider-registry.js";
import { FakeOAuthTokenVerifierService } from "../../mocks/fake-oauth-token-verifier.service.js";
import { FakePushProvider } from "../../mocks/fake-push.provider.js";
import { FakeSunTimeProvider } from "../../mocks/fake-sun-time.provider.js";
import { FakeWeatherProvider } from "../../mocks/fake-weather.provider.js";
import { TestDatabase } from "../../setup/test-database.js";
import { E2eHelpers } from "./e2e-helpers.js";
import { createE2eTestStateResetter, type TestStateResetter } from "./e2e-test-state.js";
import { TrackingDomainEventPublisher } from "./tracking-domain-event-publisher.js";

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
  };

  const closeTestResources = async (): Promise<void> => {
    const errors: unknown[] = [];
    try {
      await closeApplicationResources();
    } catch (error) {
      errors.push(error);
    }
    try {
      await testDatabase.stop();
    } catch (error) {
      errors.push(error);
    }
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
    .useValue({ db: testDatabase.getClient() })
    .overrideProvider(TransactionalEmailSender)
    .useValue(fakeEmailService)
    .overrideProvider(OAuthTokenVerifierService)
    .useValue(fakeOAuthTokenVerifierService)
    .overrideProvider(OAUTH_IDENTITY_PROVIDER_REGISTRY)
    .useFactory({
      inject: [TypedConfigService],
      factory: (configService: TypedConfigService) => {
        const delegates = createOAuthProviderRegistry(
          configService,
          fakeOAuthTokenVerifierService,
          new HttpClient({ retry: false, throwOnHttpError: false }),
        );
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

  if (!options?.withRealThrottler) {
    builder = builder.overrideProvider(ThrottlerGuard).useValue({ canActivate: async () => true });
  }

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
    // Supertest의 요청별 임시 서버 재시작 대신 suite 전체에서 같은 HTTP 서버를 사용한다.
    await app.listen(0, "127.0.0.1");

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
