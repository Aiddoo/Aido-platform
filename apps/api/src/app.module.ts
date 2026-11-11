import { ClsPluginTransactional } from "@nestjs-cls/transactional";
import { TransactionalAdapterDrizzleOrm } from "@nestjs-cls/transactional-adapter-drizzle-orm";
import { Module } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerGuard, ThrottlerModule, type ThrottlerStorage } from "@nestjs/throttler";
import { SentryModule } from "@sentry/nestjs/setup";
import { ClsModule } from "nestjs-cls";

import { AccessModule } from "#api/modules/access/access.module";
import { AiAssistanceModule } from "#api/modules/ai-assistance/ai-assistance.module";
import { AppConfigModule as AppConfigContextModule } from "#api/modules/app-config/app-config.module";
import { BillingModule } from "#api/modules/billing/billing.module";
import { EngagementModule } from "#api/modules/engagement/engagement.module";
import { JwtAuthGuard } from "#api/modules/identity/auth/identity-auth.public";
import { TimezoneSelfHealInterceptor } from "#api/modules/identity/identity-settings.public";
import { IdentityModule } from "#api/modules/identity/identity.module";
import { LastActiveInterceptor } from "#api/modules/identity/users/identity-users.public";
import { InsightsModule } from "#api/modules/insights/insights.module";
import { NotesModule } from "#api/modules/notes/notes.module";
import { NotificationModule } from "#api/modules/notification/notification.module";
import { OperationsModule } from "#api/modules/operations/operations.module";
import { PlanningModule } from "#api/modules/planning/planning.module";
import { SocialModule } from "#api/modules/social/social.module";
import { SupportModule } from "#api/modules/support/support.module";
import { VoiceModule } from "#api/modules/voice/voice.module";
import { WeatherModule } from "#api/modules/weather/weather.module";
import { CacheModule } from "#api/platform/cache/cache.module";
import { AppConfigModule } from "#api/platform/config/config.module";
import { throttleConfig } from "#api/platform/config/throttle.config";
import { DRIZZLE } from "#api/platform/database/database.client";
import { DatabaseModule } from "#api/platform/database/database.module";
import { DedupModule } from "#api/platform/dedup/dedup.module";
import { EncryptionModule } from "#api/platform/encryption/encryption.module";
import { DomainEventsModule } from "#api/platform/events/domain-events.module";
import { HealthModule } from "#api/platform/health/health.module";
import { RequestClientModule } from "#api/platform/http/request-client/request-client.module";
import { REQUEST_CLIENT_CLS_MIDDLEWARE } from "#api/platform/http/request-client/request-client.store";
import { AppI18nModule } from "#api/platform/i18n/i18n.module";
import { JobQueueModule } from "#api/platform/jobs/job-queue.module";
import { LockModule } from "#api/platform/lock/lock.module";
import { LoggerModule } from "#api/platform/logging/logger.module";
import { MeteringModule } from "#api/platform/metering/metering.module";
import { AlertingModule } from "#api/platform/observability/alerting.module";
import { PaginationModule } from "#api/platform/pagination/pagination.module";
import { RedisModule } from "#api/platform/redis/redis.module";
import { ResilienceModule } from "#api/platform/resilience/resilience.module";
import { SharedKernelModule } from "#api/platform/shared-kernel.module";
import { THROTTLER_STORAGE } from "#api/platform/throttle/throttle.constants";
import { ThrottleModule } from "#api/platform/throttle/throttle.module";
import {
  DAILY_THROTTLER_OPTIONS,
  UserAwareThrottlerGuard,
} from "#api/platform/throttle/user-aware-throttler.guard";
import { TimeModule } from "#api/platform/time/time.module";

import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";

@Module({
  imports: [
    AppConfigModule,
    AppI18nModule,

    SentryModule.forRoot(),

    DatabaseModule,
    // UNIT_OF_WORK가 쓰는 TransactionHost를 전역 제공한다. nested 전파는 Drizzle savepoint로 처리된다.
    ClsModule.forRoot({
      global: true,
      middleware: REQUEST_CLIENT_CLS_MIDDLEWARE,
      plugins: [
        new ClsPluginTransactional({
          imports: [DatabaseModule],
          adapter: new TransactionalAdapterDrizzleOrm({ drizzleInstanceToken: DRIZZLE }),
        }),
      ],
    }),
    RequestClientModule,
    EncryptionModule,
    // 도메인 이벤트 — 발행 포트는 DomainEventsModule(@Global), after-commit 구독의 커밋 뒤 전달은 EventEmitter2.
    // 와일드카드 off(기본값): 구독 이름 채널만 쓴다.
    EventEmitterModule.forRoot(),
    DomainEventsModule,
    RedisModule.forRoot(),
    CacheModule.forRoot(),
    DedupModule.forRoot(),
    LockModule.forRoot(),
    JobQueueModule,
    AlertingModule,
    ResilienceModule,
    MeteringModule,
    AccessModule,
    LoggerModule.forRootAsync(),
    SharedKernelModule,
    TimeModule,
    PaginationModule,
    ThrottlerModule.forRootAsync({
      imports: [ThrottleModule.forRoot()],
      inject: [throttleConfig.KEY, { token: THROTTLER_STORAGE, optional: true }],
      useFactory: (config: ConfigType<typeof throttleConfig>, storage?: ThrottlerStorage) => ({
        throttlers: [
          {
            ttl: config.ttlMs,
            limit: config.limit,
          },
          DAILY_THROTTLER_OPTIONS,
        ],
        ...(storage && { storage }),
      }),
    }),

    OperationsModule,
    AppConfigContextModule,
    AiAssistanceModule,
    VoiceModule,
    IdentityModule,
    SocialModule,
    InsightsModule,
    HealthModule,
    SupportModule,
    NotesModule,
    NotificationModule,
    BillingModule,
    PlanningModule,
    EngagementModule,
    WeatherModule,
  ],
  controllers: [AppController],

  providers: [
    AppService,
    // 테스트가 ThrottlerGuard 토큰으로 우회하므로 같은 토큰에 사용자 기준 tracker를 붙인 구현을 둔다
    { provide: ThrottlerGuard, useClass: UserAwareThrottlerGuard },

    {
      provide: APP_GUARD,
      useExisting: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useExisting: ThrottlerGuard,
    },

    {
      provide: APP_INTERCEPTOR,
      useExisting: LastActiveInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useExisting: TimezoneSelfHealInterceptor,
    },
  ],
})
export class AppModule {}
