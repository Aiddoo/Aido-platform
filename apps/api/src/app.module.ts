import { ClsPluginTransactional } from "@nestjs-cls/transactional";
import { TransactionalAdapterDrizzleOrm } from "@nestjs-cls/transactional-adapter-drizzle-orm";
import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerGuard, ThrottlerModule, type ThrottlerStorage } from "@nestjs/throttler";
import { SentryModule } from "@sentry/nestjs/setup";
import { ClsModule } from "nestjs-cls";

import { AccessModule } from "#api/modules/access/access.module";
import { AiAssistanceParsingModule } from "#api/modules/ai-assistance/ai-assistance-parsing.public";
import { AiAssistanceReportsModule } from "#api/modules/ai-assistance/ai-assistance-reports.public";
import { AiAssistanceSuggestionsModule } from "#api/modules/ai-assistance/ai-assistance-suggestions.public";
import { AppConfigModule as AppConfigContextModule } from "#api/modules/app-config/app-config.module";
import { BillingModule } from "#api/modules/billing/billing.module";
import { EngagementCommentsModule } from "#api/modules/engagement/engagement-comments.public";
import { JwtAuthGuard } from "#api/modules/identity/auth/identity-auth.public";
import { TimezoneSelfHealInterceptor } from "#api/modules/identity/identity-settings.public";
import { IdentityModule } from "#api/modules/identity/identity.module";
import { LastActiveInterceptor } from "#api/modules/identity/users/identity-users.public";
import { InsightsDailyCompletionsModule } from "#api/modules/insights/insights-daily-completions.public";
import { InsightsWeeklyAchievementsModule } from "#api/modules/insights/insights-weekly-achievements.public";
import { NotesModule } from "#api/modules/notes/notes.module";
import { NotificationModule } from "#api/modules/notification/notification.module";
import { OperationsModule } from "#api/modules/operations/operations.module";
import { PlanningModule } from "#api/modules/planning/planning.module";
import { SocialBlocksModule } from "#api/modules/social/social-blocks.public";
import { SocialCheersModule } from "#api/modules/social/social-cheers.public";
import { SocialFriendsModule } from "#api/modules/social/social-friends.public";
import { SocialInvitesModule } from "#api/modules/social/social-invites.public";
import { SocialNudgesModule } from "#api/modules/social/social-nudges.public";
import {
  SocialReportsAdminModule,
  SocialReportsModule,
} from "#api/modules/social/social-reports.public";
import { SupportModule } from "#api/modules/support/support.module";
import { VoiceModule } from "#api/modules/voice/voice.public";
import { WeatherModule } from "#api/modules/weather/weather.module";
import { CacheModule } from "#api/platform/cache/index";
import { AppConfigModule, TypedConfigService } from "#api/platform/config/index";
import { DatabaseModule, DRIZZLE } from "#api/platform/database/index";
import { DedupModule } from "#api/platform/dedup/index";
import { EncryptionModule } from "#api/platform/encryption/index";
import { DomainEventsModule } from "#api/platform/events/index";
import { HealthModule } from "#api/platform/health/index";
import {
  REQUEST_CLIENT_CLS_MIDDLEWARE,
  RequestClientModule,
} from "#api/platform/http/request-client/index";
import { AppI18nModule } from "#api/platform/i18n/i18n.module";
import { JobRuntimeModule } from "#api/platform/jobs/job-runtime.module";
import { LockModule } from "#api/platform/lock/index";
import { LoggerModule } from "#api/platform/logging/index";
import { MeteringModule } from "#api/platform/metering/index";
import { AlertingModule } from "#api/platform/observability/alerting.module";
import { PaginationModule } from "#api/platform/pagination/pagination.module";
import { RedisModule } from "#api/platform/redis/index";
import { ResilienceModule } from "#api/platform/resilience/index";
import { SharedKernelModule } from "#api/platform/shared-kernel.module";
import {
  DAILY_THROTTLER_OPTIONS,
  THROTTLER_STORAGE,
  ThrottleModule,
  UserAwareThrottlerGuard,
} from "#api/platform/throttle/index";
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
    // 도메인 이벤트 — 발행 포트는 DomainEventsModule(@Global), 전송은 EventEmitter2.
    // 와일드카드 off(기본값): 구독은 명시적 이벤트명(@OnEvent)만 사용한다.
    EventEmitterModule.forRoot(),
    DomainEventsModule,
    RedisModule.forRoot(),
    CacheModule.forRoot(),
    DedupModule.forRoot(),
    LockModule.forRoot(),
    JobRuntimeModule,
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
      inject: [TypedConfigService, { token: THROTTLER_STORAGE, optional: true }],
      useFactory: (config: TypedConfigService, storage?: ThrottlerStorage) => ({
        throttlers: [
          {
            ttl: config.throttleTtl,
            limit: config.throttleLimit,
          },
          DAILY_THROTTLER_OPTIONS,
        ],
        ...(storage && { storage }),
      }),
    }),

    OperationsModule,
    AppConfigContextModule,
    AiAssistanceParsingModule,
    AiAssistanceReportsModule,
    AiAssistanceSuggestionsModule,
    VoiceModule,
    IdentityModule,
    SocialBlocksModule,
    SocialCheersModule,
    InsightsDailyCompletionsModule,
    SocialFriendsModule,
    HealthModule,
    SupportModule,
    NotesModule,
    NotificationModule,
    SocialNudgesModule,
    SocialInvitesModule,
    SocialReportsModule,
    SocialReportsAdminModule,
    BillingModule,
    PlanningModule,
    EngagementCommentsModule,
    WeatherModule,
    InsightsWeeklyAchievementsModule,
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
