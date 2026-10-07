import type { ErrorCodeType } from "@aido/api/errors";
import type { Type } from "@nestjs/common";
import type { z } from "zod";

/**
 * @ApiDoc 데코레이터 옵션
 */
export interface ApiDocOptions {
  /** API 요약 (필수) */
  summary: string;
  /** API 상세 설명 */
  description?: string;
  /** API 고유 식별자 (클라이언트 SDK 생성 시 사용) */
  operationId?: string;
  /** Deprecated 표시 여부 */
  deprecated?: boolean;
  /** 공통 에러 응답(400, 500) 자동 포함 여부 (기본값: true) */
  includeCommonErrors?: boolean;
}

/**
 * @ApiSuccessResponse 데코레이터 옵션
 */
export interface ApiSuccessResponseOptions<T = unknown> {
  /** HTTP 상태 코드 (기본값: 200) */
  status?: number;
  /** 응답 설명 */
  description?: string;
  /** 응답 데이터 스키마 */
  type: z.ZodType<T> | Type<T>;
  /** 배열 응답 여부 */
  isArray?: boolean;
}

/**
 * @ApiCreatedResponse 데코레이터 옵션
 */
export interface ApiCreatedResponseOptions<T = unknown> {
  /** 응답 설명 */
  description?: string;
  /** 응답 데이터 스키마 */
  type: z.ZodType<T> | Type<T>;
}

/**
 * @ApiErrorResponse 데코레이터 옵션
 */
export interface ApiErrorResponseOptions {
  /** 에러 코드 (ErrorCode 상수 값) */
  errorCode: ErrorCodeType;
  /** 커스텀 설명 (생략시 ERROR_MESSAGE 사용) */
  description?: string;
}
