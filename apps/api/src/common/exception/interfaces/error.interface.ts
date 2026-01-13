import type { ErrorCode } from "../constants/error.constant";

/**
 * 에러 응답 인터페이스
 */
export interface ErrorResponse {
	success: false;
	error: {
		code: ErrorCode;
		message: string;
		details?: unknown;
	};
	timestamp: number;
}

/**
 * 비즈니스 예외 생성 옵션
 */
export interface BusinessExceptionOptions {
	errorCode: ErrorCode;
	details?: unknown;
	message?: string;
	statusCode?: number;
}
