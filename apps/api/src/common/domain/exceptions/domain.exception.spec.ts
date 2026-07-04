/**
 * Domain/Application 예외 단위 테스트
 *
 * GWT 패턴 적용
 * - 에러 코드 보존, 기본 메시지 폴백, 커스텀 메시지 우선 검증
 */

import { ErrorCode, Errors } from "@aido/errors";
import { ApplicationException } from "./application.exception";
import { DomainException } from "./domain.exception";
import { ErrorCodedException } from "./error-coded.exception";

describe("DomainException — 도메인 예외", () => {
	it("에러 코드와 details를 보존한다", () => {
		// Given
		const details = { todoId: 1 };

		// When
		const exception = new DomainException(ErrorCode.TODO_0801, details);

		// Then
		expect(exception.errorCode).toBe(ErrorCode.TODO_0801);
		expect(exception.details).toEqual(details);
		expect(exception.name).toBe("DomainException");
	});

	it("메시지를 생략하면 Errors 정의의 기본 메시지를 사용한다", () => {
		// Given
		const errorCode = ErrorCode.TODO_0801;

		// When
		const exception = new DomainException(errorCode);

		// Then
		expect(exception.message).toBe(Errors[errorCode].message);
	});

	it("커스텀 메시지를 전달하면 기본 메시지보다 우선한다", () => {
		// Given
		const customMessage = "커스텀 에러 메시지";

		// When
		const exception = new DomainException(
			ErrorCode.TODO_0801,
			undefined,
			customMessage,
		);

		// Then
		expect(exception.message).toBe(customMessage);
	});

	it("ErrorCodedException과 Error의 인스턴스이다", () => {
		// Given & When
		const exception = new DomainException(ErrorCode.SYS_0001);

		// Then
		expect(exception).toBeInstanceOf(ErrorCodedException);
		expect(exception).toBeInstanceOf(Error);
	});
});

describe("ApplicationException — 애플리케이션 예외", () => {
	it("에러 코드와 details를 보존한다", () => {
		// Given
		const details = { userId: "user-123" };

		// When
		const exception = new ApplicationException(ErrorCode.USER_0601, details);

		// Then
		expect(exception.errorCode).toBe(ErrorCode.USER_0601);
		expect(exception.details).toEqual(details);
		expect(exception.name).toBe("ApplicationException");
	});

	it("ErrorCodedException의 인스턴스이다", () => {
		// Given & When
		const exception = new ApplicationException(ErrorCode.SYS_0001);

		// Then
		expect(exception).toBeInstanceOf(ErrorCodedException);
	});
});
