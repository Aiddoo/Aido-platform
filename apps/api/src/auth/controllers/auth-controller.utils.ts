import type { Request } from "express";

import { BusinessException } from "@/shared/application/exceptions/business-exception.service";

import type { RequestMetadata } from "../types/auth.types";

/**
 * 요청에서 메타데이터 추출
 */
export function extractMetadata(req: Request): RequestMetadata {
	const forwarded = req.headers["x-forwarded-for"];
	const ip = Array.isArray(forwarded)
		? forwarded[0]
		: forwarded?.split(",")[0] || req.ip;

	return {
		ip: ip || undefined,
		userAgent: req.headers["user-agent"],
		deviceName: req.headers["x-device-name"] as string | undefined,
		deviceType: req.headers["x-device-type"] as string | undefined,
	};
}

/**
 * OAuth 콜백 에러를 URLSearchParams로 변환
 * BusinessException인 경우 에러 코드를 포함
 */
export function buildOAuthErrorParams(
	error: unknown,
	state: string,
): URLSearchParams {
	let errorCode = "authentication_failed";
	let errorMessage = "인증 처리 중 오류가 발생했습니다.";

	if (error instanceof BusinessException) {
		errorCode = error.errorCode;
		errorMessage = error.message;
	}

	return new URLSearchParams({
		error: errorCode,
		error_description: errorMessage,
		state,
	});
}
