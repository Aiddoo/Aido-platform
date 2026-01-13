import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import {
	ExceptionModule,
	LoggerModule,
	PaginationModule,
	ResponseModule,
} from "@/common";
import { DatabaseModule } from "@/database";
import { HealthModule } from "@/modules/health";
import { TodoModule } from "@/modules/todo";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { validateEnv } from "./config";

@Module({
	imports: [
		// Infrastructure Modules
		DatabaseModule,

		// Feature Modules
		TodoModule,
		HealthModule,

		// Configuration Modules
		ConfigModule.forRoot({
			isGlobal: true,
			validate: validateEnv,
		}),

		// Global Modules
		ThrottlerModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (config: ConfigService) => [
				{
					ttl: config.get<number>("THROTTLE_TTL", 60000),
					limit: config.get<number>("THROTTLE_LIMIT", 100),
				},
			],
		}),

		// Common Modules
		LoggerModule.forRoot({
			level: process.env.NODE_ENV !== "production" ? "debug" : "info",
			prettyPrint: process.env.NODE_ENV !== "production",
		}),
		ExceptionModule,
		ResponseModule,
		PaginationModule,
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
