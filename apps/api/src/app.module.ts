import { ClsPluginTransactional } from "@nestjs-cls/transactional";
import { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerGuard, ThrottlerModule, type ThrottlerStorage } from "@nestjs/throttler";
import { SentryModule } from "@sentry/nestjs/setup";
import { ClsModule } from "nestjs-cls";

import { AdminNotificationModule } from "#api/admin-notification/index";
import { AdminModule } from "#api/admin/index";
import { AiReportModule } from "#api/ai-report/index";
import { AiSuggestionModule } from "#api/ai-suggestion/index";
import { AiModule } from "#api/ai/index";
import { AppConfigModule as FeatureDiscoveryAppConfigModule } from "#api/app-config/index";
import { AuthModule, JwtAuthGuard, LastActiveInterceptor } from "#api/auth/index";
import { CheerModule } from "#api/cheer/index";
import { DailyCompletionModule } from "#api/daily-completion/index";
import { FollowModule } from "#api/follow/index";
import { HealthModule } from "#api/health/index";
import { InquiryModule } from "#api/inquiry/index";
import { MemoModule } from "#api/memo/index";
import { NotificationModule } from "#api/notification/index";
import { NudgeModule } from "#api/nudge/index";
import { SchedulerModule } from "#api/scheduler/index";
import { PaginationModule } from "#api/shared/application/pagination/index";
import { CacheModule } from "#api/shared/infrastructure/cache/index";
import type { EnvConfig } from "#api/shared/infrastructure/config/index";
import { AppConfigModule } from "#api/shared/infrastructure/config/index";
import { DatabaseModule, DatabaseService } from "#api/shared/infrastructure/database/index";
import { DedupModule } from "#api/shared/infrastructure/dedup/index";
import { EncryptionModule } from "#api/shared/infrastructure/encryption/index";
import { EntitlementModule } from "#api/shared/infrastructure/entitlement/entitlement.module";
import { DomainEventsModule } from "#api/shared/infrastructure/events/index";
import { JobRuntimeModule } from "#api/shared/infrastructure/jobs/job-runtime.module";
import { LockModule } from "#api/shared/infrastructure/lock/index";
import { LoggerModule } from "#api/shared/infrastructure/logging/index";
import { RedisModule } from "#api/shared/infrastructure/redis/index";
import { SharedKernelModule } from "#api/shared/infrastructure/shared-kernel.module";
import { THROTTLER_STORAGE, ThrottleModule } from "#api/shared/infrastructure/throttle/index";
import { SubscriptionModule } from "#api/subscription/index";
import { TodoCategoryModule } from "#api/todo-category/index";
import { TodoCommentModule } from "#api/todo-comment/index";
import { TodoModule } from "#api/todo/index";
import { TimezoneSelfHealInterceptor, UserSettingsModule } from "#api/user-settings/index";
import { WeatherModule } from "#api/weather/weather.module";
import { WeeklyAchievementModule } from "#api/weekly-achievement/index";

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
		// 기존 database.$transaction(fn) 시맨틱을 그대로 보존한다.
		ClsModule.forRoot({
			global: true,
			plugins: [
				new ClsPluginTransactional({
					imports: [DatabaseModule],
					adapter: new TransactionalAdapterPrisma({
						prismaInjectionToken: DatabaseService,
					}),
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
		EntitlementModule,
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
		CheerModule,
		DailyCompletionModule,
		FollowModule,
		HealthModule,
		InquiryModule,
		MemoModule,
		NotificationModule,
		NudgeModule,
		SchedulerModule,
		SubscriptionModule,
		TodoModule,
		TodoCommentModule,
		TodoCategoryModule,
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
