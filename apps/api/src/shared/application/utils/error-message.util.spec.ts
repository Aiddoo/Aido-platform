import { toErrorType } from "./error-message.util.js";

describe("toErrorType — 로그용 에러 종류", () => {
  it("Error 인스턴스는 name을, 그 밖의 값은 UnknownError를 반환한다", () => {
    // Given
    const error = new TypeError("secret detail");

    // When
    const errorType = toErrorType(error);
    const rawValueType = toErrorType("raw");

    // Then
    expect(errorType).toBe("TypeError");
    expect(rawValueType).toBe("UnknownError");
  });
});
