import {
	Injectable,
	type LoggerService as NestLoggerService,
} from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import type { LogContext } from "../interfaces/logger.interface";

/**
 * Pino Logger를 래핑한 서비스
 * NestJS LoggerService 인터페이스를 구현하여 호환성 유지
 */
@Injectable()
export class LoggerService implements NestLoggerService {
	constructor(private readonly pino: PinoLogger) {}

	/**
	 * 로그 컨텍스트 설정
	 */
	setContext(context: string): void {
		this.pino.setContext(context);
	}

	/**
	 * INFO 레벨 로그
	 */
	log(message: string, context?: LogContext | string): void {
		if (typeof context === "string") {
			this.pino.setContext(context);
			this.pino.info(message);
		} else {
			this.pino.info(context ?? {}, message);
		}
	}

	/**
	 * ERROR 레벨 로그
	 */
	error(message: string, trace?: string, context?: LogContext | string): void {
		const logData: LogContext = typeof context === "object" ? context : {};
		if (trace) {
			logData.stack = trace;
		}
		if (typeof context === "string") {
			this.pino.setContext(context);
		}
		this.pino.error(logData, message);
	}

	/**
	 * WARN 레벨 로그
	 */
	warn(message: string, context?: LogContext | string): void {
		if (typeof context === "string") {
			this.pino.setContext(context);
			this.pino.warn(message);
		} else {
			this.pino.warn(context ?? {}, message);
		}
	}

	/**
	 * DEBUG 레벨 로그
	 */
	debug(message: string, context?: LogContext | string): void {
		if (typeof context === "string") {
			this.pino.setContext(context);
			this.pino.debug(message);
		} else {
			this.pino.debug(context ?? {}, message);
		}
	}

	/**
	 * VERBOSE 레벨 로그 (debug로 매핑)
	 */
	verbose(message: string, context?: LogContext | string): void {
		this.debug(message, context);
	}

	/**
	 * FATAL 레벨 로그
	 */
	fatal(message: string, context?: LogContext | string): void {
		if (typeof context === "string") {
			this.pino.setContext(context);
			this.pino.fatal(message);
		} else {
			this.pino.fatal(context ?? {}, message);
		}
	}

	/**
	 * 구조화된 로그 출력
	 */
	logWithData(
		level: "info" | "warn" | "error" | "debug",
		message: string,
		data: LogContext,
	): void {
		this.pino[level](data, message);
	}
}
