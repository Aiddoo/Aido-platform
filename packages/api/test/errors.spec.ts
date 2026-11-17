import { ErrorCode, Errors, HttpStatus, isErrorCode } from "../src/errors/index.js";

describe("@aido/api/errors", () => {
  describe("ErrorCode", () => {
    it("모든 에러 코드가 정의되어 있어야 한다", () => {
      // When
      const codes = Object.keys(ErrorCode);

      // Then
      expect(codes.length).toBeGreaterThan(0);
    });

    it("에러 코드가 올바른 형식이어야 한다", () => {
      // When
      const codes = Object.values(ErrorCode);

      // Then
      for (const code of codes) {
        // TODO_CATEGORY_0851 같은 복합 도메인 지원
        expect(code).toMatch(/^[A-Z]+(?:_[A-Z]+)?_\d{4}$/);
      }
    });
  });

  describe("Errors", () => {
    it("모든 에러 코드에 대한 정의가 존재해야 한다", () => {
      // When
      const codes = Object.values(ErrorCode);

      // Then
      for (const code of codes) {
        expect(Errors[code]).toBeDefined();
        expect(Errors[code].code).toBe(code);
        expect(Errors[code].message).toBeTruthy();
        expect(Errors[code].description).toBeTruthy();
        expect(Errors[code].httpStatus).toBeDefined();
      }
    });

    it("HTTP 상태 코드가 유효해야 한다", () => {
      // Given
      const validStatuses = Object.values(HttpStatus);

      // When
      const errors = Object.values(Errors);

      // Then
      for (const error of errors) {
        expect(validStatuses).toContain(error.httpStatus);
      }
    });
  });

  describe("isErrorCode", () => {
    it("유효한 에러 코드를 검증할 수 있어야 한다", () => {
      // When
      const authCode = isErrorCode("AUTH_0101");
      const systemCode = isErrorCode("SYS_0001");

      // Then
      expect(authCode).toBe(true);
      expect(systemCode).toBe(true);
    });

    it("유효하지 않은 에러 코드를 거부해야 한다", () => {
      // When
      const malformedCode = isErrorCode("INVALID_CODE");
      const emptyCode = isErrorCode("");

      // Then
      expect(malformedCode).toBe(false);
      expect(emptyCode).toBe(false);
    });

    it("상속된 Object 프로퍼티 이름을 에러 코드로 취급하지 않아야 한다", () => {
      // When
      const toStringName = isErrorCode("toString");
      const constructorName = isErrorCode("constructor");
      const protoName = isErrorCode("__proto__");

      // Then
      expect(toStringName).toBe(false);
      expect(constructorName).toBe(false);
      expect(protoName).toBe(false);
    });
  });
});
