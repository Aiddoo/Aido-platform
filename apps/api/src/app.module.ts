import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import {
	ThrottlerGuard,
	ThrottlerModule,
	type ThrottlerStorage,
} from "@nestjs/throttler";
import { SentryModule } from "@sentry/nestjs/setup";
import type Redis from "ioredis";
import {
	AppConfigModule,
	CacheModule,
	DedupModule,
	EncryptionModule,
	EntitlementModule,
	ExceptionModule,
	LockModule,
	LoggerModule,
	PaginationModule,
	REDIS_CLIENT,
	RedisModule,
	ResponseModule,
} from "@/common";
import type { EnvConfig } from "@/common/config";
import { THROTTLER_STORAGE, ThrottleModule } from "@/common/throttle";
import { DatabaseModule } from "@/database";
import { AdminModule } from "@/modules/admin";
import { AdminNotificationModule } from "@/modules/admin-notification";
import { AiModule } from "@/modules/ai";
import { AiReportModule } from "@/modules/ai-report";
import { AiSuggestionModule } from "@/modules/ai-suggestion";
import { AuthModule } from "@/modules/auth";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { LastActiveInterceptor } from "@/modules/auth/interceptors/last-active.interceptor";
import { CheerModule } from "@/modules/cheer";
import { DailyCompletionModule } from "@/modules/daily-completion";
import { FollowModule } from "@/modules/follow";
import { HealthModule } from "@/modules/health";
import { InquiryModule } from "@/modules/inquiry";
import { MemoModule } from "@/modules/memo";
import { NotificationModule } from "@/modules/notification";
import { NudgeModule } from "@/modules/nudge";
import { SchedulerModule } from "@/modules/scheduler";
import { SubscriptionModule } from "@/modules/subscription";
import { TodoModule } from "@/modules/todo";
import { TodoCategoryModule } from "@/modules/todo-category";
import { UserSettingsModule } from "@/modules/user-settings";
import { WeatherModule } from "@/modules/weather/weather.module";
import { WeeklyAchievementModule } from "@/modules/weekly-achievement";
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
		EncryptionModule,
		RedisModule.forRoot(),
		CacheModule.forRoot(),
		DedupModule.forRoot(),
		LockModule.forRoot(),
		BullModule.forRootAsync({
			inject: [REDIS_CLIENT],
			useFactory: (redis: Redis) => ({
				connection: redis,
				defaultJobOptions: {
					attempts: 3,
					backoff: { type: "exponential" as const, delay: 1_000 },
					removeOnComplete: true,
					removeOnFail: { count: 100, age: 86_400 },
				},
			}),
		}),
		// 4. Global Modules
		EntitlementModule,
		LoggerModule.forRootAsync(),
		ExceptionModule,
		ResponseModule,
		PaginationModule,
		ThrottlerModule.forRootAsync({
			imports: [ThrottleModule.forRoot()],
			inject: [ConfigService, { token: THROTTLER_STORAGE, optional: true }],
			useFactory: (
				config: ConfigService<EnvConfig, true>,
				storage?: ThrottlerStorage,
			) => ({
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
			useClass: JwtAuthGuard,
		},
		{
			provide: APP_GUARD,
			useClass: ThrottlerGuard,
		},

		// Global Interceptors
		{
			provide: APP_INTERCEPTOR,
			useClass: LastActiveInterceptor,
		},
	],
})
export class AppModule {}
