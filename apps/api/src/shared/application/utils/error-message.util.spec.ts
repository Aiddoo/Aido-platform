import { toErrorMessage, toErrorType } from "./error-message.util.js";

describe("toErrorMessage — 에러 메시지 정규화", () => {
  it("Error 인스턴스는 message를 반환한다", () => {
    expect(toErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("Error가 아닌 값은 문자열로 변환한다", () => {
    expect(toErrorMessage("raw")).toBe("raw");
    expect(toErrorMessage(42)).toBe("42");
    expect(toErrorMessage(undefined)).toBe("undefined");
  });
});

describe("toErrorType — 로그용 에러 종류", () => {
  it("Error 인스턴스는 name을, 그 밖의 값은 UnknownError를 반환한다", () => {
    const error = new TypeError("secret detail");
    expect(toErrorType(error)).toBe("TypeError");
    expect(toErrorType("raw")).toBe("UnknownError");
  });
});
