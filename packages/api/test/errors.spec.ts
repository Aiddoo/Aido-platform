import { ErrorCode, Errors, HttpStatus, isErrorCode } from "../src/errors/index.js";

describe("@aido/api/errors", () => {
  describe("ErrorCode", () => {
    it("모든 에러 코드가 정의되어 있어야 한다", () => {
      expect(Object.keys(ErrorCode).length).toBeGreaterThan(0);
    });

    it("에러 코드가 올바른 형식이어야 한다", () => {
      for (const code of Object.values(ErrorCode)) {
        // TODO_CATEGORY_0851 같은 복합 도메인 지원
        expect(code).toMatch(/^[A-Z]+(?:_[A-Z]+)?_\d{4}$/);
      }
    });
  });

  describe("Errors", () => {
    it("모든 에러 코드에 대한 정의가 존재해야 한다", () => {
      for (const code of Object.values(ErrorCode)) {
        expect(Errors[code]).toBeDefined();
        expect(Errors[code].code).toBe(code);
        expect(Errors[code].message).toBeTruthy();
        expect(Errors[code].description).toBeTruthy();
        expect(Errors[code].httpStatus).toBeDefined();
      }
    });

    it("HTTP 상태 코드가 유효해야 한다", () => {
      const validStatuses = Object.values(HttpStatus);
      for (const error of Object.values(Errors)) {
        expect(validStatuses).toContain(error.httpStatus);
      }
    });
  });

  describe("isErrorCode", () => {
    it("유효한 에러 코드를 검증할 수 있어야 한다", () => {
      expect(isErrorCode("AUTH_0101")).toBe(true);
      expect(isErrorCode("SYS_0001")).toBe(true);
    });

    it("유효하지 않은 에러 코드를 거부해야 한다", () => {
      expect(isErrorCode("INVALID_CODE")).toBe(false);
      expect(isErrorCode("")).toBe(false);
    });

    it("상속된 Object 프로퍼티 이름을 에러 코드로 취급하지 않아야 한다", () => {
      expect(isErrorCode("toString")).toBe(false);
      expect(isErrorCode("constructor")).toBe(false);
      expect(isErrorCode("__proto__")).toBe(false);
    });
  });
});
