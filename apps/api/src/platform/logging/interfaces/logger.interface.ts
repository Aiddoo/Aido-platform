import type { LogLevel } from "../constants/logger.constant.js";

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
  /** 자동 로깅 활성화 */
  autoLogging?: boolean;
}
