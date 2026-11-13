import { ErrorCode, Errors } from "@aido/api/errors";

import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";

import { ApplicationException } from "./application.exception.js";

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

  it("업체 오류를 코드로 바꿀 때 원본을 cause로 남겨 예외 보고가 원인을 잇는다", () => {
    // Given
    const upstream = new Error("upstream timeout");

    // When
    const exception = new ApplicationException(ErrorCode.WEATHER_1901, undefined, {
      cause: upstream,
    });

    // Then
    expect(exception.cause).toBe(upstream);
    expect(exception.message).toBe(Errors[ErrorCode.WEATHER_1901].message);
  });

  it("ErrorCodedException의 인스턴스이다", () => {
    // Given & When
    const exception = new ApplicationException(ErrorCode.SYS_0001);

    // Then
    expect(exception).toBeInstanceOf(ErrorCodedException);
  });
});
