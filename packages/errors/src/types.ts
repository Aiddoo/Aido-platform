import type { HttpStatus } from './http-status';

/**
 * 에러 정의 인터페이스
 * @description FAANG 스타일 Numeric 에러 코드 패턴
 */
export interface ErrorDefinition {
  /** Numeric 에러 코드 (e.g., "AUTH_0101", "USER_0601") */
  code: string;

  /** 사용자 친화적 메시지 (한국어) */
  message: string;

  /** 개발자용 상세 설명 (디버깅 및 문서화 목적) */
  description: string;

  /** HTTP 상태 코드 */
  httpStatus: HttpStatus;
}

/**
 * 에러 응답 형식 (API 응답용)
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    description?: string;
    details?: unknown;
    timestamp?: string;
    path?: string;
  };
}
