import { type ErrorCodeType, Errors } from "@aido/errors";

/**
 * 에러 코드 기반 예외 베이스
 *
 * 도메인/애플리케이션 계층에서 HTTP(NestJS)에 의존하지 않고 예외를 던지기 위한
 * 순수 베이스 클래스입니다. `@aido/errors`의 ErrorCode를 담으며,
 * GlobalExceptionFilter가 BusinessException과 동일한 응답 포맷으로 변환합니다.
 */
export abstract class ErrorCodedException extends Error {
	protected constructor(
		public readonly errorCode: ErrorCodeType,
		public readonly details?: unknown,
		message?: string,
	) {
		super(message ?? Errors[errorCode].message);
	}
}
