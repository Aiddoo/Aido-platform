import { ErrorCode, type ErrorCodeType, Errors } from './errors';
import type { ErrorDefinition, ErrorResponse } from './types';

/**
 * 에러 코드로 에러 정의 가져오기
 */
export function getError(code: ErrorCodeType): ErrorDefinition {
  return Errors[code];
}

/**
 * 에러 코드 유효성 검사
 */
export function isErrorCode(code: string): code is ErrorCodeType {
  return code in ErrorCode;
}

/**
 * 에러 응답 객체 생성
 */
export function createErrorResponse(
  code: ErrorCodeType,
  options?: {
    details?: unknown;
    timestamp?: string;
    path?: string;
  },
): ErrorResponse {
  const errorDef = getError(code);
  return {
    error: {
      code: errorDef.code,
      message: errorDef.message,
      description: errorDef.description,
      details: options?.details,
      timestamp: options?.timestamp,
      path: options?.path,
    },
  };
}

/**
 * HTTP 상태 코드로 에러 정의 가져오기
 */
export function getErrorsByHttpStatus(httpStatus: number): ErrorDefinition[] {
  return Object.values(Errors).filter((error) => error.httpStatus === httpStatus);
}

/**
 * 도메인별 에러 코드 가져오기
 */
export function getErrorsByDomain(
  domain:
    | 'SYS'
    | 'AUTH'
    | 'SOCIAL'
    | 'KAKAO'
    | 'APPLE'
    | 'GOOGLE'
    | 'NAVER'
    | 'EMAIL'
    | 'USER'
    | 'SESSION'
    | 'VERIFY'
    | 'TODO',
): ErrorDefinition[] {
  return Object.values(Errors).filter((error) => error.code.startsWith(domain));
}

/**
 * 모든 에러 코드 목록 가져오기
 */
export function getAllErrorCodes(): ErrorCodeType[] {
  return Object.values(ErrorCode) as ErrorCodeType[];
}

/**
 * 모든 에러 정의 가져오기
 */
export function getAllErrors(): ErrorDefinition[] {
  return Object.values(Errors);
}
