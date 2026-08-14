import type { ErrorCodeType } from "@aido/errors";

import { ErrorCodedException } from "./error-coded.exception";

/**
 * 애플리케이션 예외
 *
 * 유스케이스(커맨드/쿼리 핸들러) 오케스트레이션 실패 시 사용합니다.
 * (예: 대상 리소스 없음, 권한 없음, 중복 요청)
 */
export class ApplicationException extends ErrorCodedException {
	constructor(errorCode: ErrorCodeType, details?: unknown, message?: string) {
		super(errorCode, details, message);
		this.name = "ApplicationException";
	}
}
