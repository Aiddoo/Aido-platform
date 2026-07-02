import type { ErrorCodeType } from "@aido/errors";
import { ErrorCodedException } from "./error-coded.exception";

/**
 * 도메인 예외
 *
 * 도메인 엔티티/VO의 비즈니스 불변식 위반 시 사용합니다.
 * (예: 이미 완료된 할 일을 다시 완료 처리, 도메인 한도 초과)
 */
export class DomainException extends ErrorCodedException {
	constructor(errorCode: ErrorCodeType, details?: unknown, message?: string) {
		super(errorCode, details, message);
		this.name = "DomainException";
	}
}
