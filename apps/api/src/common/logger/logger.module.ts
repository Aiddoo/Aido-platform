import { type DynamicModule, Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LoggerModule as PinoLoggerModule } from "nestjs-pino";
import type { EnvConfig } from "../config";
import { LOGGER_REDACT_PATHS } from "./constants/logger.constant";
import type { LoggerModuleOptions } from "./interfaces/logger.interface";
import { LoggerService } from "./services/logger.service";

/**
 * 환경에 따른 기본 로그 레벨 결정
 * - test: silent (테스트 결과만 깔끔하게 출력)
 * - production: info (운영 환경에서 필요한 정보만)
 * - development: debug (개발 시 상세 로그)
 *
 * LOG_LEVEL 환경변수로 오버라이드 가능:
 * @example LOG_LEVEL=debug pnpm test:e2e
 */
function getDefaultLogLevel(nodeEnv: string): string {
	switch (nodeEnv) {
		case "test":
			return "silent";
		case "production":
			return "info";
		default:
			return "debug";
	}
}

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
		const nodeEnv = process.env.NODE_ENV ?? "development";
		const isTest = nodeEnv === "test";

		const {
			level = process.env.LOG_LEVEL ?? getDefaultLogLevel(nodeEnv),
			prettyPrint = nodeEnv !== "production" && !isTest,
			redactPaths = [...LOGGER_REDACT_PATHS],
			autoLogging = !isTest, // 테스트 환경에서는 HTTP 자동 로깅 비활성화
		} = options;

		return {
			module: LoggerModule,
			imports: [
				PinoLoggerModule.forRoot({
					pinoHttp: {
						transport: prettyPrint
							? {
									target: "pino-pretty",
									options: { colorize: true, customColors: "warn:red" },
								}
							: undefined,
						level,
						// 에러 응답은 GlobalExceptionFilter가 로깅하므로 피노는 성공 응답만
						autoLogging: autoLogging
							? {
									ignore: (req) => ((req as any).res?.statusCode ?? 200) >= 400,
								}
							: false,
						redact: redactPaths,
						// req/res/responseTime 숨김 (메시지만 출력)
						serializers: {
							req: () => undefined,
							res: () => undefined,
							responseTime: () => undefined,
						},
						customSuccessMessage: (req, res, responseTime) => {
							const userId = (req as any).user?.userId ?? "anonymous";
							return `${req.method} ${req.url} ${res.statusCode} ${Math.round(responseTime as number)}ms [user:${userId}]`;
						},
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
		const { redactPaths = [...LOGGER_REDACT_PATHS] } = options;

		return {
			module: LoggerModule,
			imports: [
				PinoLoggerModule.forRootAsync({
					inject: [ConfigService],
					useFactory: (configService: ConfigService<EnvConfig, true>) => {
						const nodeEnv = configService.get("NODE_ENV", { infer: true });
						const isTest = nodeEnv === "test";

						// 로그 레벨 우선순위: options.level > LOG_LEVEL 환경변수 > 기본값
						const level =
							options.level ??
							process.env.LOG_LEVEL ??
							getDefaultLogLevel(nodeEnv);

						// 테스트 환경에서는 pretty print 비활성화
						const prettyPrint =
							options.prettyPrint ?? (nodeEnv !== "production" && !isTest);

						// 테스트 환경에서는 HTTP 자동 로깅 비활성화
						const autoLogging = options.autoLogging ?? !isTest;

						return {
							pinoHttp: {
								transport: prettyPrint
									? {
											target: "pino-pretty",
											options: { colorize: true, customColors: "warn:red" },
										}
									: undefined,
								level,
								// 에러 응답은 GlobalExceptionFilter가 로깅하므로 피노는 성공 응답만
								autoLogging: autoLogging
									? {
											ignore: (req) =>
												((req as any).res?.statusCode ?? 200) >= 400,
										}
									: false,
								redact: redactPaths,
								// req/res/responseTime 숨김 (메시지만 출력)
								serializers: {
									req: () => undefined,
									res: () => undefined,
									responseTime: () => undefined,
								},
								customSuccessMessage: (req, res, responseTime) => {
									const userId = (req as any).user?.userId ?? "anonymous";
									return `${req.method} ${req.url} ${res.statusCode} ${Math.round(responseTime as number)}ms [user:${userId}]`;
								},
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
