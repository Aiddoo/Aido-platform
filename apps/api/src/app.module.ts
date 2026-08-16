import { ClsPluginTransactional } from "@nestjs-cls/transactional";
import { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerGuard, ThrottlerModule, type ThrottlerStorage } from "@nestjs/throttler";
import { SentryModule } from "@sentry/nestjs/setup";
import { ClsModule } from "nestjs-cls";

import { AdminModule } from "@/admin";
import { AdminNotificationModule } from "@/admin-notification";
import { AiModule } from "@/ai";
import { AiReportModule } from "@/ai-report";
import { AiSuggestionModule } from "@/ai-suggestion";
import { AppConfigModule as FeatureDiscoveryAppConfigModule } from "@/app-config";
import { AuthModule, JwtAuthGuard, LastActiveInterceptor } from "@/auth";
import { CheerModule } from "@/cheer";
import { DailyCompletionModule } from "@/daily-completion";
import { FollowModule } from "@/follow";
import { HealthModule } from "@/health";
import { InquiryModule } from "@/inquiry";
import { MemoModule } from "@/memo";
import { NotificationModule } from "@/notification";
import { NudgeModule } from "@/nudge";
import { SchedulerModule } from "@/scheduler";
import { PaginationModule } from "@/shared/application/pagination";
import { CacheModule } from "@/shared/infrastructure/cache";
import type { EnvConfig } from "@/shared/infrastructure/config";
import { AppConfigModule } from "@/shared/infrastructure/config";
import { DatabaseModule, DatabaseService } from "@/shared/infrastructure/database";
import { DedupModule } from "@/shared/infrastructure/dedup";
import { EncryptionModule } from "@/shared/infrastructure/encryption";
import { EntitlementModule } from "@/shared/infrastructure/entitlement/entitlement.module";
import { DomainEventsModule } from "@/shared/infrastructure/events";
import { JobRuntimeModule } from "@/shared/infrastructure/jobs/job-runtime.module";
import { LockModule } from "@/shared/infrastructure/lock";
import { LoggerModule } from "@/shared/infrastructure/logging";
import { RedisModule } from "@/shared/infrastructure/redis";
import { SharedKernelModule } from "@/shared/infrastructure/shared-kernel.module";
import { THROTTLER_STORAGE, ThrottleModule } from "@/shared/infrastructure/throttle";
import { SubscriptionModule } from "@/subscription";
import { TodoModule } from "@/todo";
import { TodoCategoryModule } from "@/todo-category";
import { TodoCommentModule } from "@/todo-comment";
import { TimezoneSelfHealInterceptor, UserSettingsModule } from "@/user-settings";
import { WeatherModule } from "@/weather/weather.module";
import { WeeklyAchievementModule } from "@/weekly-achievement";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";

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

		// Global Guards
		{
			provide: APP_GUARD,
			useExisting: JwtAuthGuard,
		},
		{
			provide: APP_GUARD,
			useClass: ThrottlerGuard,
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
