import { ClsPluginTransactional } from "@nestjs-cls/transactional";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerGuard, ThrottlerModule, type ThrottlerStorage } from "@nestjs/throttler";
import { SentryModule } from "@sentry/nestjs/setup";
import { ClsModule } from "nestjs-cls";

import { AccessModule } from "#api/modules/access/access.module";
import { AiModule } from "#api/modules/ai-assistance/ai-assistance-parsing.public";
import { AiReportModule } from "#api/modules/ai-assistance/ai-assistance-reports.public";
import { AiSuggestionModule } from "#api/modules/ai-assistance/ai-assistance-suggestions.public";
import { AppConfigModule as FeatureDiscoveryAppConfigModule } from "#api/modules/app-config/app-config-discovery.public";
import { SubscriptionModule } from "#api/modules/billing/billing-subscriptions.public";
import { TodoCommentModule } from "#api/modules/engagement/engagement-comments.public";
import {
  AuthModule,
  JwtAuthGuard,
  LastActiveInterceptor,
} from "#api/modules/identity/identity-auth.public";
import {
  TimezoneSelfHealInterceptor,
  UserSettingsModule,
} from "#api/modules/identity/identity-settings.public";
import { DailyCompletionModule } from "#api/modules/insights/insights-daily-completions.public";
import { WeeklyAchievementModule } from "#api/modules/insights/insights-weekly-achievements.public";
import { NotesMemosModule } from "#api/modules/notes/notes-memos.public";
import { NotificationModule } from "#api/modules/notification/notification-delivery.public";
import { SchedulerModule } from "#api/modules/notification/notification-reminders.public";
import { AdminModule } from "#api/modules/operations/operations-admin.public";
import { AdminNotificationModule } from "#api/modules/operations/operations-notifications.public";
import { PlanningCategoriesModule } from "#api/modules/planning/planning-categories.public";
import { PlanningTodosModule } from "#api/modules/planning/planning-todos.public";
import { SocialCheersModule } from "#api/modules/social/social-cheers.public";
import { SocialFriendsModule } from "#api/modules/social/social-friends.public";
import { SocialNudgesModule } from "#api/modules/social/social-nudges.public";
import { InquiryModule } from "#api/modules/support/support-inquiries.public";
import { WeatherModule } from "#api/modules/weather/weather-forecast.module";
import { CacheModule } from "#api/platform/cache/index";
import type { EnvConfig } from "#api/platform/config/index";
import { AppConfigModule } from "#api/platform/config/index";
import { DatabaseModule, DatabaseService } from "#api/platform/database/index";
import { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import { DedupModule } from "#api/platform/dedup/index";
import { EncryptionModule } from "#api/platform/encryption/index";
import { DomainEventsModule } from "#api/platform/events/index";
import { HealthModule } from "#api/platform/health/index";
import { JobRuntimeModule } from "#api/platform/jobs/job-runtime.module";
import { LockModule } from "#api/platform/lock/index";
import { LoggerModule } from "#api/platform/logging/index";
import { PaginationModule } from "#api/platform/pagination/pagination.module";
import { RedisModule } from "#api/platform/redis/index";
import { SharedKernelModule } from "#api/platform/shared-kernel.module";
import { THROTTLER_STORAGE, ThrottleModule } from "#api/platform/throttle/index";

import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";

@Module({
  imports: [
    // 1. Configuration (Must be loaded first)
    AppConfigModule,

    // 2. Monitoring
    SentryModule.forRoot(),

    // 3. Infrastructure
    DatabaseModule,
    // CLS 트랜잭션 플러그인 — UNIT_OF_WORK(ClsUnitOfWork)가 사용하는
    // TransactionHost를 전역 제공. withTransaction이 자체 CLS 스코프를 열므로
    // 미들웨어/가드 마운트는 불필요. 어댑터에 옵션을 지정하지 않아
    // native transaction의 commit·rollback과 CLS 전파를 연결한다.
    ClsModule.forRoot({
      global: true,
      plugins: [
        new ClsPluginTransactional({
          imports: [DatabaseModule],
          adapter: new Prisma8TransactionalAdapter(DatabaseService),
        }),
      ],
    }),
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
    // 4. Global Modules
    AccessModule,
    LoggerModule.forRootAsync(),
    SharedKernelModule,
    PaginationModule,
    ThrottlerModule.forRootAsync({
      imports: [ThrottleModule.forRoot()],
      inject: [ConfigService, { token: THROTTLER_STORAGE, optional: true }],
      useFactory: (config: ConfigService<EnvConfig, true>, storage?: ThrottlerStorage) => ({
        throttlers: [
          {
            ttl: config.get("THROTTLE_TTL", { infer: true }),
            limit: config.get("THROTTLE_LIMIT", { infer: true }),
          },
        ],
        ...(storage && { storage }),
      }),
    }),

    // 5. Features
    AdminModule,
    AdminNotificationModule,
    FeatureDiscoveryAppConfigModule,
    AiModule,
    AiReportModule,
    AiSuggestionModule,
    AuthModule,
    SocialCheersModule,
    DailyCompletionModule,
    SocialFriendsModule,
    HealthModule,
    InquiryModule,
    NotesMemosModule,
    NotificationModule,
    SocialNudgesModule,
    SchedulerModule,
    SubscriptionModule,
    PlanningTodosModule,
    TodoCommentModule,
    PlanningCategoriesModule,
    UserSettingsModule,
    WeatherModule,
    WeeklyAchievementModule,
  ],
  // Controllers
  controllers: [AppController],

  // Providers
  providers: [
    AppService,
    ThrottlerGuard,

    // Global Guards
    {
      provide: APP_GUARD,
      useExisting: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useExisting: ThrottlerGuard,
    },

    // Global Interceptors
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
