import { type DynamicModule, Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LoggerModule as PinoLoggerModule } from "nestjs-pino";
import type { EnvConfig } from "../config";
import { LOGGER_REDACT_PATHS } from "./constants/logger.constant";
import type { LoggerModuleOptions } from "./interfaces/logger.interface";
import { LoggerService } from "./services/logger.service";

/**
 * Logger 모듈
 * Pino Logger를 래핑하여 전역에서 사용 가능하게 제공
 */
@Global()
@Module({})
export class LoggerModule {
	/**
	 * 동적 모듈 설정 (동기)
	 * ConfigModule이 로드되기 전에 사용할 때
	 */
	static forRoot(options: LoggerModuleOptions = {}): DynamicModule {
		const {
			level = process.env.NODE_ENV !== "production" ? "debug" : "info",
			prettyPrint = process.env.NODE_ENV !== "production",
			redactPaths = [...LOGGER_REDACT_PATHS],
			autoLogging = true,
		} = options;

		return {
			module: LoggerModule,
			imports: [
				PinoLoggerModule.forRoot({
					pinoHttp: {
						transport: prettyPrint
							? { target: "pino-pretty", options: { colorize: true } }
							: undefined,
						level,
						autoLogging,
						redact: redactPaths,
					},
				}),
			],
			providers: [LoggerService],
			exports: [LoggerService, PinoLoggerModule],
		};
	}

	/**
	 * 동적 모듈 설정 (비동기)
	 * ConfigService를 통해 타입 안전하게 환경변수 사용
	 */
	static forRootAsync(options: LoggerModuleOptions = {}): DynamicModule {
		const { redactPaths = [...LOGGER_REDACT_PATHS], autoLogging = true } =
			options;

		return {
			module: LoggerModule,
			imports: [
				PinoLoggerModule.forRootAsync({
					inject: [ConfigService],
					useFactory: (configService: ConfigService<EnvConfig, true>) => {
						const nodeEnv = configService.get("NODE_ENV", { infer: true });
						const isDevelopment = nodeEnv !== "production";

						// options에서 level, prettyPrint가 명시적으로 제공되면 우선 사용
						const level = options.level ?? (isDevelopment ? "debug" : "info");
						const prettyPrint = options.prettyPrint ?? isDevelopment;

						return {
							pinoHttp: {
								transport: prettyPrint
									? { target: "pino-pretty", options: { colorize: true } }
									: undefined,
								level,
								autoLogging,
								redact: redactPaths,
							},
						};
					},
				}),
			],
			providers: [LoggerService],
			exports: [LoggerService, PinoLoggerModule],
		};
	}
}
