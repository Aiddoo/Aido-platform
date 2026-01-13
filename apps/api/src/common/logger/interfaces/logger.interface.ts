import type { LogLevel } from "../constants/logger.constant";

/**
 * Logger 모듈 옵션
 */
export interface LoggerModuleOptions {
	/** 로그 레벨 */
	level?: LogLevel;
	/** Pretty print 활성화 (개발 환경용) */
	prettyPrint?: boolean;
	/** 민감정보 마스킹 경로 */
	redactPaths?: string[];
	/** 로깅 제외 라우트 */
	excludedRoutes?: string[];
	/** 자동 로깅 활성화 */
	autoLogging?: boolean;
}

/**
 * 로그 컨텍스트 데이터
 */
export interface LogContext {
	[key: string]: unknown;
}

/**
 * 구조화된 로그 메시지
 */
export interface StructuredLog {
	message: string;
	context?: string;
	data?: LogContext;
	error?: Error;
	stack?: string;
}
