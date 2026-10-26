import { errorEnvelopeSchema } from "@aido/api";
import { ErrorCode, Errors } from "@aido/api/errors";
/**
 * GlobalExceptionFilter 테스트
 *
 * Prisma SQLSTATE 23505 매핑, 업무 오류, HttpException, 알 수 없는 에러 처리 검증
 */
import { type ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import type { PinoLogger } from "nestjs-pino";
import { vi, type Mock } from "vitest";
import { mock, type MockProxy } from "vitest-mock-extended";

import type { TypedConfigService } from "#api/platform/config/services/config.service";
import { ApplicationExceptions } from "#api/shared/application/exceptions/application-exceptions";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";
import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { sqlQueryError } from "#test/mocks/database.mock";

import { GlobalExceptionFilter } from "./global-exception.filter.js";

vi.mock("@sentry/nestjs", () => ({
  captureException: vi.fn(),
  withScope: vi.fn((callback: (scope: unknown) => void) => {
    callback({
      setUser: vi.fn(),
      setTags: vi.fn(),
      setExtra: vi.fn(),
    });
  }),
}));

type HttpArgumentsHost = ReturnType<ArgumentsHost["switchToHttp"]>;

describe("GlobalExceptionFilter — 전역 예외 필터", () => {
  let filter: GlobalExceptionFilter;
  let mockLogger: MockProxy<PinoLogger>;
  let mockConfigService: TypedConfigService;
  let mockResponse: { status: Mock; json: Mock };
  let mockRequest: { method: string; url: string; user?: { userId: string } };
  let mockHost: MockProxy<ArgumentsHost>;

  const createFilter = (isDevelopment = true) => {
    mockConfigService = mock<TypedConfigService>({ isDevelopment });
    return new GlobalExceptionFilter(mockLogger, mockConfigService);
  };

  beforeEach(() => {
    mockLogger = mock<PinoLogger>();

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    mockRequest = {
      method: "POST",
      url: "/test",
    };

    const httpHost = mock<HttpArgumentsHost>();
    httpHost.getResponse.mockImplementation(() => mockResponse);
    httpHost.getRequest.mockImplementation(() => mockRequest);
    mockHost = mock<ArgumentsHost>();
    mockHost.switchToHttp.mockReturnValue(httpHost);

    filter = createFilter(true);
  });

  describe("PostgreSQL unique violation 에러 처리", () => {
    it("알려진 constraint(email)를 업무 오류으로 매핑해야 한다", () => {
      // Given
      const error = sqlQueryError("23505", "User_email_key");

      // When
      filter.catch(error, mockHost);

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.code).toBe(ErrorCode.EMAIL_0501);
    });

    it("알려진 constraint(userId_name)를 업무 오류으로 매핑해야 한다", () => {
      // Given
      const error = sqlQueryError("23505", "TodoCategory_userId_name_key");

      // When
      filter.catch(error, mockHost);

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.code).toBe(ErrorCode.TODO_CATEGORY_0853);
    });

    it("알려진 constraint(followerId_followingId)를 업무 오류으로 매핑해야 한다", () => {
      // Given
      const error = sqlQueryError("23505", "Follow_followerId_followingId_key");

      // When
      filter.catch(error, mockHost);

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.code).toBe(ErrorCode.FOLLOW_0901);
    });

    it("알 수 없는 constraint를 SYS_0004 (409)로 폴백해야 한다", () => {
      // Given
      const error = sqlQueryError("23505");

      // When
      filter.catch(error, mockHost);

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.code).toBe(ErrorCode.SYS_0004);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Unknown database unique constraint"),
      );
    });

    it("SQLSTATE 23503 FK constraint violation은 400 SYS_0002로 처리해야 한다", () => {
      // Given
      const error = sqlQueryError("23503");

      // When
      filter.catch(error, mockHost);

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.code).toBe(ErrorCode.SYS_0002);
    });

    it("처리되지 않은 Prisma 에러는 500 SYS_0001로 처리해야 한다", () => {
      // Given
      const error = sqlQueryError("XX000");

      // When
      filter.catch(error, mockHost);

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.code).toBe(ErrorCode.SYS_0001);
    });
  });

  describe("기존 동작 유지", () => {
    it("업무 오류을 올바르게 처리해야 한다", () => {
      // Given
      const exception = ApplicationExceptions.todoCategoryNotFound(1);

      // When
      filter.catch(exception, mockHost);

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(Errors[exception.errorCode].httpStatus);
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.code).toBe(ErrorCode.TODO_CATEGORY_0851);
    });

    it("HttpException을 올바르게 처리해야 한다", () => {
      // Given
      const exception = new HttpException({ message: "Bad Request" }, HttpStatus.BAD_REQUEST);

      // When
      filter.catch(exception, mockHost);

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.code).toBe(ErrorCode.SYS_0002);
    });

    it("알 수 없는 에러를 500 SYS_0001로 처리해야 한다", () => {
      // Given
      const exception = new Error("unexpected error");

      // When
      filter.catch(exception, mockHost);

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.code).toBe(ErrorCode.SYS_0001);
    });
  });

  describe("Sentry 캡처", () => {
    it("5xx 서버 에러는 Sentry에 scope 컨텍스트와 함께 캡처해야 한다", () => {
      // Given
      const exception = new Error("unexpected server error");

      // When
      filter.catch(exception, mockHost);

      // Then
      expect(Sentry.withScope).toHaveBeenCalledTimes(1);
      expect(Sentry.captureException).toHaveBeenCalledWith(exception);
    });

    it("4xx 클라이언트 에러는 Sentry에 캡처하지 않아야 한다", () => {
      // Given
      const exception = new HttpException({ message: "Bad Request" }, HttpStatus.BAD_REQUEST);

      // When
      filter.catch(exception, mockHost);

      // Then
      expect(Sentry.withScope).not.toHaveBeenCalled();
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it("업무 오류(4xx)은 Sentry에 캡처하지 않아야 한다", () => {
      // Given
      const exception = ApplicationExceptions.todoCategoryNotFound(1);

      // When
      filter.catch(exception, mockHost);

      // Then
      expect(Sentry.withScope).not.toHaveBeenCalled();
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });
  });

  describe("details 노출 제어", () => {
    it("development 환경에서 HttpException의 details가 포함된다", () => {
      // Given
      filter = createFilter(true);
      const exception = new HttpException(
        { message: "Bad Request", extra: "info" },
        HttpStatus.BAD_REQUEST,
      );

      // When
      filter.catch(exception, mockHost);

      // Then
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.details).toBeDefined();
    });

    it("production 환경에서 HttpException의 details가 포함되지 않는다", () => {
      // Given
      filter = createFilter(false);
      const exception = new HttpException(
        { message: "Bad Request", extra: "info" },
        HttpStatus.BAD_REQUEST,
      );

      // When
      filter.catch(exception, mockHost);

      // Then
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.details).toBeUndefined();
    });

    it("development 환경에서 알 수 없는 에러의 details가 포함된다", () => {
      // Given
      filter = createFilter(true);
      const exception = new Error("unexpected error");

      // When
      filter.catch(exception, mockHost);

      // Then
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.details).toBe("unexpected error");
    });

    it("production 환경에서도 친구 한도 초과는 공개 상세(current·limit)만 싣는다", () => {
      // Given
      filter = createFilter(false);
      const exception = new ApplicationException(ErrorCode.FOLLOW_0909, {
        current: 6,
        limit: 6,
        userId: "user-123",
      });

      // When
      filter.catch(exception, mockHost);

      // Then
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.details).toEqual({ current: 6, limit: 6 });
    });

    it("production 환경에서 공개 상세가 없는 업무 오류의 details는 싣지 않는다", () => {
      // Given
      filter = createFilter(false);
      const exception = new ApplicationException(ErrorCode.USER_0601, { userId: "user-123" });

      // When
      filter.catch(exception, mockHost);

      // Then
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error).not.toHaveProperty("details");
    });

    it("production 환경에서 알 수 없는 에러의 details가 포함되지 않는다", () => {
      // Given
      filter = createFilter(false);
      const exception = new Error("unexpected error");

      // When
      filter.catch(exception, mockHost);

      // Then
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.details).toBeUndefined();
    });
  });

  describe("Domain/Application 예외 정규화", () => {
    it("DomainException을 업무 오류과 동일한 응답 포맷으로 변환한다", () => {
      // Given
      const exception = new DomainException(ErrorCode.TODO_0801, {
        todoId: 1,
      });
      const expected = ApplicationExceptions.todoNotFound(1);

      // When
      filter.catch(exception, mockHost);

      // Then - 동일 ErrorCode의 업무 오류과 상태/바디가 동일
      expect(mockResponse.status).toHaveBeenCalledWith(Errors[expected.errorCode].httpStatus);
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.code).toBe(expected.errorCode);
      expect(jsonArg?.error.message).toBe(expected.message);
      expect(jsonArg?.error.details).toEqual(expected.details);
      expect(jsonArg.success).toBe(false);
    });

    it("ApplicationException을 업무 오류과 동일한 응답 포맷으로 변환한다", () => {
      // Given
      const exception = new ApplicationException(ErrorCode.USER_0601, {
        userId: "user-123",
      });

      // When
      filter.catch(exception, mockHost);

      // Then
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.code).toBe(ErrorCode.USER_0601);
      expect(jsonArg.success).toBe(false);
    });

    it("커스텀 메시지가 있는 DomainException은 메시지를 보존한다", () => {
      // Given
      const exception = new DomainException(ErrorCode.TODO_0801, undefined, "커스텀 도메인 메시지");

      // When
      filter.catch(exception, mockHost);

      // Then
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.message).toBe("커스텀 도메인 메시지");
    });

    it("production 환경에서 DomainException의 details가 제거된다", () => {
      // Given
      filter = createFilter(false);
      const exception = new DomainException(ErrorCode.TODO_0801, {
        todoId: 1,
      });

      // When
      filter.catch(exception, mockHost);

      // Then
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.details).toBeUndefined();
    });
  });
  it("오류 로그에는 인증 query와 외부 오류 원문을 남기지 않고 기존 응답을 유지한다", () => {
    // Given
    mockRequest.url = "/oauth/callback?code=secret-code&state=secret-state";
    const exception = new Error("Provider rejected secret-token");

    // When
    filter.catch(exception, mockHost);

    // Then
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: ErrorCode.SYS_0001, details: exception.message }),
      }),
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "http.request.failed",
        path: "/oauth/callback",
        statusCode: 500,
        errorType: "Error",
      }),
      "HTTP 요청 실패",
    );
    const recorded = JSON.stringify(mockLogger.error.mock.calls);
    for (const secret of ["secret-code", "secret-state", "secret-token"])
      expect(recorded).not.toContain(secret);
  });

  describe("공유 errorEnvelopeSchema 계약", () => {
    const exceptions = {
      업무_오류: () => ApplicationExceptions.invalidParameter({ reason: "invalid" }),
      HttpException: () => new HttpException({ message: ["a", "b"] }, HttpStatus.BAD_REQUEST),
      알_수_없는_에러: () => new Error("boom"),
      데이터베이스_에러: () => sqlQueryError("23505", "User_email_key"),
    };

    it.each(Object.entries(exceptions))("%s 응답이 envelope 스키마를 만족한다", (_name, create) => {
      for (const isDevelopment of [true, false]) {
        createFilter(isDevelopment).catch(create(), mockHost);
        const body = mockResponse.json.mock.lastCall?.[0];
        expect(errorEnvelopeSchema.safeParse(body).success).toBe(true);
      }
    });
  });
});
