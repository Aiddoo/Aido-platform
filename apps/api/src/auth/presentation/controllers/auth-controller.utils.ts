import type { Request } from "express";
import type { RequestMetadata } from "@/auth/application/types/auth.types";
import { ErrorCodedException } from "@/shared/domain/exceptions/error-coded.exception";

/**
 * 요청에서 메타데이터 추출
 */
export function extractMetadata(req: Request): RequestMetadata {
	return {
		ip: req.ip || undefined,
		userAgent: req.headers["user-agent"],
		deviceName: req.headers["x-device-name"] as string | undefined,
		deviceType: req.headers["x-device-type"] as string | undefined,
	};
}

/**
 * OAuth 콜백 에러를 URLSearchParams로 변환
 * 에러 코드가 있는 예외(ApplicationException/DomainException)면 코드를 포함
 */
export function buildOAuthErrorParams(
	error: unknown,
	state: string,
): URLSearchParams {
	let errorCode = "authentication_failed";
	let errorMessage = "인증 처리 중 오류가 발생했습니다.";

	if (error instanceof ErrorCodedException) {
		errorCode = error.errorCode;
		errorMessage = error.message;
	}

	return new URLSearchParams({
		error: errorCode,
		error_description: errorMessage,
		state,
	});
}
