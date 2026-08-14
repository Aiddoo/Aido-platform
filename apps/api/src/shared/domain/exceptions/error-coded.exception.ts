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
		// 패키지 버전 불일치 등으로 코드 매핑이 없어도 2차 TypeError 없이 안전하게 폴백
		super(message ?? Errors[errorCode]?.message ?? "알 수 없는 오류가 발생했습니다.");
	}
}
