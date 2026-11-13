import { type ErrorCodeType, Errors } from "@aido/api/errors";

export interface ErrorCodedExceptionOptions extends ErrorOptions {
  /** 코드의 기본 문구 대신 응답에 그대로 싣는 문구 */
  readonly message?: string;
}

/**
 * 에러 코드 기반 예외 베이스
 *
 * 도메인/애플리케이션 계층에서 HTTP(NestJS)에 의존하지 않고 예외를 던지기 위한
 * 순수 베이스 클래스입니다. `@aido/api/errors`의 ErrorCode를 담으며,
 * HTTP 오류 변환은 Platform의 GlobalExceptionFilter가 소유합니다.
 * 업체·DB 오류를 코드로 바꿀 때는 원본을 `cause`로 넘겨 예외 보고에 원인이 남게 한다.
 */
export abstract class ErrorCodedException extends Error {
  readonly errorCode: ErrorCodeType;
  readonly details?: unknown;

  protected constructor(
    errorCode: ErrorCodeType,
    details?: unknown,
    options?: ErrorCodedExceptionOptions,
  ) {
    super(options?.message ?? Errors[errorCode].message, options);
    this.errorCode = errorCode;
    this.details = details;
  }
}
