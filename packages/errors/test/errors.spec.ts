import {
  createErrorResponse,
  ErrorCode,
  Errors,
  getAllErrorCodes,
  getAllErrors,
  getError,
  getErrorsByDomain,
  getErrorsByHttpStatus,
  HttpStatus,
  isErrorCode,
} from '../src';

describe('@aido/errors', () => {
  describe('ErrorCode', () => {
    it('모든 에러 코드가 정의되어 있어야 한다', () => {
      expect(Object.keys(ErrorCode).length).toBeGreaterThan(0);
    });

    it('에러 코드가 올바른 형식이어야 한다', () => {
      for (const code of Object.values(ErrorCode)) {
        // TODO_CATEGORY_0851 같은 복합 도메인 지원
        expect(code).toMatch(/^[A-Z]+(?:_[A-Z]+)?_\d{4}$/);
      }
    });
  });

  describe('Errors', () => {
    it('모든 에러 코드에 대한 정의가 존재해야 한다', () => {
      for (const code of Object.values(ErrorCode)) {
        expect(Errors[code]).toBeDefined();
        expect(Errors[code].code).toBe(code);
        expect(Errors[code].message).toBeTruthy();
        expect(Errors[code].description).toBeTruthy();
        expect(Errors[code].httpStatus).toBeDefined();
      }
    });

    it('HTTP 상태 코드가 유효해야 한다', () => {
      const validStatuses = Object.values(HttpStatus);
      for (const error of Object.values(Errors)) {
        expect(validStatuses).toContain(error.httpStatus);
      }
    });
  });

  describe('getError', () => {
    it('에러 코드로 에러 정의를 가져올 수 있어야 한다', () => {
      const error = getError(ErrorCode.AUTH_0101);
      expect(error.code).toBe('AUTH_0101');
      expect(error.message).toBe('유효하지 않은 토큰입니다.');
      expect(error.httpStatus).toBe(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('isErrorCode', () => {
    it('유효한 에러 코드를 검증할 수 있어야 한다', () => {
      expect(isErrorCode('AUTH_0101')).toBe(true);
      expect(isErrorCode('SYS_0001')).toBe(true);
    });

    it('유효하지 않은 에러 코드를 거부해야 한다', () => {
      expect(isErrorCode('INVALID_CODE')).toBe(false);
      expect(isErrorCode('')).toBe(false);
    });
  });

  describe('createErrorResponse', () => {
    it('에러 응답 객체를 생성할 수 있어야 한다', () => {
      const response = createErrorResponse(ErrorCode.USER_0601, {
        details: { userId: '123' },
        path: '/api/users/123',
      });

      expect(response.error.code).toBe('USER_0601');
      expect(response.error.message).toBe('사용자를 찾을 수 없습니다.');
      expect(response.error.details).toEqual({ userId: '123' });
      expect(response.error.path).toBe('/api/users/123');
    });
  });

  describe('getErrorsByHttpStatus', () => {
    it('HTTP 상태 코드로 에러를 필터링할 수 있어야 한다', () => {
      const unauthorizedErrors = getErrorsByHttpStatus(HttpStatus.UNAUTHORIZED);
      expect(unauthorizedErrors.length).toBeGreaterThan(0);
      for (const error of unauthorizedErrors) {
        expect(error.httpStatus).toBe(HttpStatus.UNAUTHORIZED);
      }
    });
  });

  describe('getErrorsByDomain', () => {
    it('도메인별 에러를 필터링할 수 있어야 한다', () => {
      const authErrors = getErrorsByDomain('AUTH');
      expect(authErrors.length).toBeGreaterThan(0);
      for (const error of authErrors) {
        expect(error.code).toMatch(/^AUTH_/);
      }
    });

    it('KAKAO 도메인 에러를 필터링할 수 있어야 한다', () => {
      const kakaoErrors = getErrorsByDomain('KAKAO');
      expect(kakaoErrors.length).toBeGreaterThan(0);
      for (const error of kakaoErrors) {
        expect(error.code).toMatch(/^KAKAO_/);
      }
    });
  });

  describe('getAllErrorCodes', () => {
    it('모든 에러 코드 목록을 가져올 수 있어야 한다', () => {
      const codes = getAllErrorCodes();
      expect(codes.length).toBe(Object.keys(ErrorCode).length);
    });
  });

  describe('getAllErrors', () => {
    it('모든 에러 정의를 가져올 수 있어야 한다', () => {
      const errors = getAllErrors();
      expect(errors.length).toBe(Object.keys(Errors).length);
    });
  });
});
