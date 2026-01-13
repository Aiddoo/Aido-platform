import { type DynamicModule, Global, Module } from "@nestjs/common";
import { LoggerModule as PinoLoggerModule } from "nestjs-pino";
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
	 * 동적 모듈 설정
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
}
