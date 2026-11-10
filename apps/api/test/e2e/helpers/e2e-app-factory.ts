import type { INestApplication, ModuleMetadata } from "@nestjs/common";
/**
 * E2E 테스트 앱 팩토리
 *
 * @description
 * 모든 E2E 테스트에서 반복되는 NestJS 앱 초기화 보일러플레이트를 통합합니다.
 * - TestDatabase (Testcontainers)
 * - 외부 서비스 Fake 처리 (Email, OAuth, Push, AI, Discord, Weather, WeatherKit)
 * - Native StandardSchemaValidationPipe
 * - PinoLogger 억제
 */
import { Test, type TestingModule } from "@nestjs/testing";
import { ThrottlerGuard } from "@nestjs/throttler";
import RedisMock from "ioredis-mock";
import { PinoLogger } from "nestjs-pino";
import type { App } from "supertest/types.js";
import { vi } from "vitest";

import { setupApiDocs } from "#api/api-docs";
import { AppModule } from "#api/app.module";
import { AiGeneratorPort } from "#api/modules/ai-assistance/generation/ai-assistance-generation.public";
import { ReportGenerationProcessor } from "#api/modules/ai-assistance/reports/infrastructure/jobs/report-generation.processor";
import { ReportGenerationScheduler } from "#api/modules/ai-assistance/reports/infrastructure/jobs/report-generation.scheduler";
import { SuggestionAnalysisProcessor } from "#api/modules/ai-assistance/suggestions/infrastructure/jobs/suggestion-analysis.processor";
import { SuggestionAnalysisScheduler } from "#api/modules/ai-assistance/suggestions/infrastructure/jobs/suggestion-analysis.scheduler";
import {
  type OAuthIdentityProviderPort,
  OAuthIdentityProviderRegistryPort,
} from "#api/modules/identity/auth/application/ports/oauth-identity-provider.port";
import type { AccountProvider } from "#api/modules/identity/auth/domain/auth.constants";
import { AppleOAuthIdentityAdapter } from "#api/modules/identity/auth/infrastructure/adapters/apple-oauth-identity.adapter";
import { Argon2PasswordHasherAdapter } from "#api/modules/identity/auth/infrastructure/adapters/argon2-password-hasher.adapter";
import { GoogleOAuthIdentityAdapter } from "#api/modules/identity/auth/infrastructure/adapters/google-oauth-identity.adapter";
import { KakaoOAuthIdentityAdapter } from "#api/modules/identity/auth/infrastructure/adapters/kakao-oauth-identity.adapter";
import { NaverOAuthIdentityAdapter } from "#api/modules/identity/auth/infrastructure/adapters/naver-oauth-identity.adapter";
import { AccountPurgeProcessor } from "#api/modules/identity/users/infrastructure/jobs/account-purge.processor";
import { AccountPurgeScheduler } from "#api/modules/identity/users/infrastructure/jobs/account-purge.scheduler";
import { EmailDeliveryQueueProcessor } from "#api/modules/notification/email/infrastructure/jobs/email-delivery-queue.processor";
import { SendTransactionalEmailUseCase } from "#api/modules/notification/notification-email.public";
import { PushProviderPort } from "#api/modules/notification/push/application/ports/push-provider.port";
import { NotificationQueueProcessor } from "#api/modules/notification/push/infrastructure/jobs/notification-queue.processor";
import { TimezoneReminderQueueProcessor } from "#api/modules/notification/reminders/infrastructure/jobs/timezone-reminder-queue.processor";
import { TimezoneReminderSweepScheduler } from "#api/modules/notification/reminders/infrastructure/jobs/timezone-reminder-sweep.scheduler";
import { TodoReminderQueueProcessor } from "#api/modules/notification/reminders/infrastructure/jobs/todo-reminder-queue.processor";
import { AdminNotifierPort } from "#api/modules/operations/admin-notices/application/ports/admin-notifier.port";
import { AdminNotificationProcessor } from "#api/modules/operations/admin-notices/infrastructure/jobs/admin-notification.processor";
import { DailySignupSummaryScheduler } from "#api/modules/operations/admin-notices/infrastructure/jobs/daily-signup-summary.scheduler";
import { TodoSeriesMaterializationProcessor } from "#api/modules/planning/todo-series/infrastructure/jobs/todo-series-materialization.processor";
import { TodoSeriesMaterializationScheduler } from "#api/modules/planning/todo-series/infrastructure/jobs/todo-series-materialization.scheduler";
import { PlanApplicationCleanupProcessor } from "#api/modules/voice/action-plans/infrastructure/jobs/plan-application-cleanup.processor";
import { PlanApplicationCleanupScheduler } from "#api/modules/voice/action-plans/infrastructure/jobs/plan-application-cleanup.scheduler";
import { AirQualityProviderPort } from "#api/modules/weather/forecasts/application/ports/air-quality-provider.port";
import { LifestyleIndexProviderPort } from "#api/modules/weather/forecasts/application/ports/lifestyle-index-provider.port";
import { SunTimeProviderPort } from "#api/modules/weather/forecasts/application/ports/sun-time-provider.port";
import { WeatherForecastProviderPort } from "#api/modules/weather/forecasts/application/ports/weather-forecast-provider.port";
import { WeatherReportProviderPort } from "#api/modules/weather/forecasts/application/ports/weather-report-provider.port";
import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import { DRIZZLE } from "#api/platform/database/index";
import { configureApplication } from "#api/platform/http/configure-application";
import { REDIS_COMMAND_CLIENT } from "#api/platform/redis/redis.constants";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { JOB_RUNTIME, JobQueuePort } from "#api/shared/application/ports/index";
import { FakePushProvider } from "#test/doubles/notification/fake-push-provider";
import { DateClock } from "#test/doubles/platform/date-clock";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import { StubWeatherReportProvider } from "#test/doubles/weather/stub-weather-report-provider";

import { FakeAdminNotifier } from "../../mocks/fake-admin-notifier.js";
import { FakeAiGenerator } from "../../mocks/fake-ai.generator.js";
import { FakeAirQualityProvider } from "../../mocks/fake-air-quality.provider.js";
import { FakeEmailService } from "../../mocks/fake-email.service.js";
import { FakeJobRuntime } from "../../mocks/fake-job-runtime.js";
import { FakeLifestyleIndexProvider } from "../../mocks/fake-lifestyle-index.provider.js";
import { FakeLogger } from "../../mocks/fake-logger.service.js";
import { FakeOAuthProviderRegistry } from "../../mocks/fake-oauth-provider-registry.js";
import { FakeOAuthTokenVerifierService } from "../../mocks/fake-oauth-token-verifier.service.js";
import { FakePasswordHasher } from "../../mocks/fake-password-hasher.js";
import { FakeSunTimeProvider } from "../../mocks/fake-sun-time.provider.js";
import { FakeWeatherProvider } from "../../mocks/fake-weather.provider.js";
import { TestDatabase } from "../../setup/test-database.js";
import { E2eHelpers } from "./e2e-helpers.js";
import { createE2eTestStateResetter, type TestStateResetter } from "./e2e-test-state.js";

/* ── 백그라운드 작업 격리 대상 ────────────────────────── */

const BACKGROUND_PROCESSORS = [
  TodoSeriesMaterializationProcessor,
  AdminNotificationProcessor,
  EmailDeliveryQueueProcessor,
  TimezoneReminderQueueProcessor,
  TodoReminderQueueProcessor,
  SuggestionAnalysisProcessor,
  ReportGenerationProcessor,
  AccountPurgeProcessor,
  NotificationQueueProcessor,
  PlanApplicationCleanupProcessor,
];

const BACKGROUND_JOBS = [
  DailySignupSummaryScheduler,
  TimezoneReminderSweepScheduler,
  SuggestionAnalysisScheduler,
  ReportGenerationScheduler,
  AccountPurgeScheduler,
  TodoSeriesMaterializationScheduler,
  PlanApplicationCleanupScheduler,
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
  customizeBuilder?: (
    builder: ReturnType<typeof Test.createTestingModule>,
  ) => ReturnType<typeof Test.createTestingModule>;
  /** AppModule 옆에 붙이는 테스트 전용 모듈(공개 데코레이터·가드를 실제 라우트처럼 검증할 때) */
  imports?: ModuleMetadata["imports"];
  /** suite에서 추가로 override한 fake의 상태 초기화 함수 */
  additionalResetters?: readonly TestStateResetter[];
  /** @internal 앱 재시작 테스트에서 동일 PostgreSQL을 재사용 */
  testDatabase?: TestDatabase;
  /** 설정은 앱이 시작할 때 env를 한 번 읽는다. 배포 환경·비밀처럼 suite마다 다른 값은 여기로 넣는다 */
  env?: Readonly<Record<string, string>>;
}

export async function createE2eApp(options?: E2eAppOptions): Promise<E2eTestContext> {
  for (const [key, value] of Object.entries(options?.env ?? {})) {
    vi.stubEnv(key, value);
  }
  const testDatabase = options?.testDatabase ?? new TestDatabase();
  if (!options?.testDatabase) {
    await testDatabase.start();
  }

  const fakeEmailService = new FakeEmailService();
  const fakeOAuthTokenVerifierService = new FakeOAuthTokenVerifierService();
  const fakeAdminNotifier = new FakeAdminNotifier();
  const fakePushProvider = new FakePushProvider();
  const fakeAiGenerator = new FakeAiGenerator();
  const fakeWeatherProvider = new FakeWeatherProvider();
  const stubWeatherReportProvider = new StubWeatherReportProvider();
  const fakeAirQualityProvider = new FakeAirQualityProvider();
  const fakeLifestyleIndexProvider = new FakeLifestyleIndexProvider();
  const fakeSunTimeProvider = new FakeSunTimeProvider();
  const fakeJobRuntime = new FakeJobRuntime();
  const inMemoryJobQueue = new InMemoryJobQueue();

  const redisMock = new RedisMock();
  const cacheAdapter = new InMemoryCacheStore({
    defaultTtlMs: 60000,
    maxItems: 1000,
  });
  let fakeOAuthProviderRegistry: FakeOAuthProviderRegistry | undefined;
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
    imports: [AppModule, ...(options?.imports ?? [])],
  })
    .overrideProvider(REDIS_COMMAND_CLIENT)
    .useValue(redisMock)
    .overrideProvider(JOB_RUNTIME)
    .useValue(fakeJobRuntime)
    // E2E 앱이 실제 pg-boss에 연결하지 않게 새 큐 포트도 메모리 구현으로 바꾼다
    .overrideProvider(JobQueuePort)
    .useValue(inMemoryJobQueue)
    // 시각을 옮기는 테스트가 Date 가짜 시계로 ClockPort도 움직이게 한다
    .overrideProvider(ClockPort)
    .useValue(new DateClock())
    .overrideProvider(CacheStorePort)
    .useValue(cacheAdapter)
    .overrideProvider(DRIZZLE)
    .useValue(testDatabase.getClient())
    .overrideProvider(Argon2PasswordHasherAdapter)
    .useClass(FakePasswordHasher)
    .overrideProvider(SendTransactionalEmailUseCase)
    .useValue(fakeEmailService)
    .overrideProvider(OAuthIdentityProviderRegistryPort)
    .useFactory({
      inject: [
        AppleOAuthIdentityAdapter,
        GoogleOAuthIdentityAdapter,
        KakaoOAuthIdentityAdapter,
        NaverOAuthIdentityAdapter,
      ],
      factory: (
        ...adapters: readonly [
          AppleOAuthIdentityAdapter,
          GoogleOAuthIdentityAdapter,
          KakaoOAuthIdentityAdapter,
          NaverOAuthIdentityAdapter,
        ]
      ) => {
        const delegates = new Map<AccountProvider, OAuthIdentityProviderPort>(
          adapters.map((adapter) => [adapter.provider, adapter]),
        );
        fakeOAuthProviderRegistry = new FakeOAuthProviderRegistry(
          delegates,
          fakeOAuthTokenVerifierService,
        );
        return fakeOAuthProviderRegistry.registry;
      },
    })
    .overrideProvider(AdminNotifierPort)
    .useValue(fakeAdminNotifier)
    .overrideProvider(PushProviderPort)
    .useValue(fakePushProvider)
    .overrideProvider(AiGeneratorPort)
    .useValue(fakeAiGenerator)
    .overrideProvider(WeatherForecastProviderPort)
    .useValue(fakeWeatherProvider)
    .overrideProvider(WeatherReportProviderPort)
    .useValue(stubWeatherReportProvider)
    .overrideProvider(AirQualityProviderPort)
    .useValue(fakeAirQualityProvider)
    .overrideProvider(LifestyleIndexProviderPort)
    .useValue(fakeLifestyleIndexProvider)
    .overrideProvider(SunTimeProviderPort)
    .useValue(fakeSunTimeProvider)
    .overrideProvider(PinoLogger)
    .useClass(FakeLogger);

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
      corsOrigins: ["http://localhost:3000"],
      enableShutdownHooks: false,
    });
    // main.ts와 같은 순서로 문서를 붙여, 개발 도구가 꺼진 설정에서 문서 경로가 열리지 않는지 E2E가 본다
    setupApiDocs(app);
    // Supertest의 요청별 임시 서버 재시작 대신 suite 전체에서 같은 HTTP 서버를 사용한다.
    await app.listen(0, "127.0.0.1");

    if (!fakeOAuthProviderRegistry) {
      throw new Error("Fake OAuth provider registry was not initialized");
    }

    const helpers = new E2eHelpers(app, fakeEmailService);
    const reset = createE2eTestStateResetter({
      cleanupDatabase: () => testDatabase.cleanup(),
      resetCache: () => cacheAdapter.reset(),
      flushRedis: () => redisMock.flushall(),
      sharedResetters: [
        () => fakeEmailService.clear(),
        () => fakeOAuthTokenVerifierService.clear(),
        () => fakeOAuthProviderRegistry?.clear(),
        () => fakeAdminNotifier.clear(),
        () => fakePushProvider.clear(),
        () => fakeAiGenerator.clear(),
        () => fakeWeatherProvider.clear(),
        () => stubWeatherReportProvider.clear(),
        () => fakeAirQualityProvider.clear(),
        () => fakeLifestyleIndexProvider.clear(),
        () => fakeSunTimeProvider.clear(),
        () => fakeJobRuntime.clear(),
        () => inMemoryJobQueue.clear(),
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
