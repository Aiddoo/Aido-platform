import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import {
	AppConfigModule,
	ExceptionModule,
	LoggerModule,
	PaginationModule,
	ResponseModule,
} from "@/common";
import type { EnvConfig } from "@/common/config";
import { DatabaseModule } from "@/database";
import { AuthModule } from "@/modules/auth/auth.module";
import { HealthModule } from "@/modules/health";
import { TodoModule } from "@/modules/todo";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

@Module({
	imports: [
		// 1. Configuration (Must be loaded first)
		AppConfigModule,

		// 2. Infrastructure
		DatabaseModule,

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
		AuthModule,
		TodoModule,
		HealthModule,
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
