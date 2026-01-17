import type { ErrorCodeType } from "@aido/errors";

/**
 * 에러 응답 인터페이스
 */
export interface ErrorResponse {
	success: false;
	error: {
		code: ErrorCodeType;
		message: string;
		details?: unknown;
	};
	timestamp: number;
}

/**
 * 비즈니스 예외 생성 옵션
 */
export interface BusinessExceptionOptions {
	errorCode: ErrorCodeType;
	details?: unknown;
	message?: string;
	statusCode?: number;
}
