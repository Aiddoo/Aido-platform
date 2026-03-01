import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { SentryModule } from "@sentry/nestjs/setup";
import {
	AppConfigModule,
	CacheModule,
	EncryptionModule,
	EntitlementModule,
	ExceptionModule,
	LockModule,
	LoggerModule,
	PaginationModule,
	ResponseModule,
} from "@/common";
import type { EnvConfig } from "@/common/config";
import { DatabaseModule } from "@/database";
import { AdminModule } from "@/modules/admin";
import { AdminNotificationModule } from "@/modules/admin-notification";
import { AiModule } from "@/modules/ai";
import { AuthModule } from "@/modules/auth";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { CheerModule } from "@/modules/cheer";
import { DailyCompletionModule } from "@/modules/daily-completion";
import { FollowModule } from "@/modules/follow";
import { HealthModule } from "@/modules/health";
import { InquiryModule } from "@/modules/inquiry";
import { NotificationModule } from "@/modules/notification";
import { NudgeModule } from "@/modules/nudge";
import { SchedulerModule } from "@/modules/scheduler";
import { SubscriptionModule } from "@/modules/subscription";
import { TodoModule } from "@/modules/todo";
import { TodoCategoryModule } from "@/modules/todo-category";
import { UserSettingsModule } from "@/modules/user-settings";
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
		CacheModule.forRoot(),
		LockModule.forRoot(),
		EventEmitterModule.forRoot({
			// 와일드카드 패턴 지원 (e.g., follow.*)
			wildcard: true,
			// 구분자
			delimiter: ".",
			// 오류 시 프로세스 종료 방지
			ignoreErrors: false,
		}),

		// 4. Global Modules
		EntitlementModule,
		LoggerModule.forRootAsync(),
		ExceptionModule,
		ResponseModule,
		PaginationModule,
		ThrottlerModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService<EnvConfig, true>) => [
				{
					ttl: config.get("THROTTLE_TTL", { infer: true }),
					limit: config.get("THROTTLE_LIMIT", { infer: true }),
				},
			],
		}),

		// 5. Features
		AdminModule,
		AdminNotificationModule,
		AiModule,
		AuthModule,
		CheerModule,
		DailyCompletionModule,
		FollowModule,
		HealthModule,
		InquiryModule,
		NotificationModule,
		NudgeModule,
		SchedulerModule,
		SubscriptionModule,
		TodoModule,
		TodoCategoryModule,
		UserSettingsModule,
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
	],
})
export class AppModule {}
