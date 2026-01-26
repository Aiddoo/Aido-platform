import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import {
	AppConfigModule,
	CacheModule,
	ExceptionModule,
	LoggerModule,
	PaginationModule,
	ResponseModule,
} from "@/common";
import type { EnvConfig } from "@/common/config";
import { DatabaseModule } from "@/database";
import { AiModule } from "@/modules/ai";
import { AuthModule } from "@/modules/auth/auth.module";
import { CheerModule } from "@/modules/cheer/cheer.module";
import { DailyCompletionModule } from "@/modules/daily-completion";
import { FollowModule } from "@/modules/follow";
import { HealthModule } from "@/modules/health";
import { NotificationModule } from "@/modules/notification/notification.module";
import { NudgeModule } from "@/modules/nudge/nudge.module";
import { SchedulerModule } from "@/modules/scheduler/scheduler.module";
import { TodoModule } from "@/modules/todo";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

@Module({
	imports: [
		// 1. Configuration (Must be loaded first)
		AppConfigModule,

		// 2. Infrastructure
		DatabaseModule,
		CacheModule.forRoot(),
		EventEmitterModule.forRoot({
			// 와일드카드 패턴 지원 (e.g., follow.*)
			wildcard: true,
			// 구분자
			delimiter: ".",
			// 오류 시 프로세스 종료 방지
			ignoreErrors: false,
		}),

		// 3. Global Modules
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

		// 4. Features
		AiModule,
		AuthModule,
		CheerModule,
		DailyCompletionModule,
		FollowModule,
		HealthModule,
		NotificationModule,
		NudgeModule,
		SchedulerModule,
		TodoModule,
	],
	// Controllers
	controllers: [AppController],

	// Providers
	providers: [
		AppService,

		// Global Guards
		{
			provide: APP_GUARD,
			useClass: ThrottlerGuard,
		},
	],
})
export class AppModule {}
