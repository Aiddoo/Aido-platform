import { errorEnvelopeSchema } from "@aido/api";
import { ErrorCode, Errors } from "@aido/api/errors";
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  MethodNotAllowedException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host.js";
import { Test } from "@nestjs/testing";
import { vi, type Mock } from "vitest";

import { ErrorMessageTranslator } from "#api/platform/i18n/error-message.translator";
import { AppI18nModule } from "#api/platform/i18n/i18n.module";
import { ApplicationException } from "#api/shared/application/application.exception";
import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { RecordingExceptionReporter } from "#test/doubles/platform/recording-exception-reporter";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import { RecordingPinoLogger } from "#test/doubles/platform/recording-pino-logger";
import { sqlQueryError } from "#test/mocks/drizzle.mock";

import { GlobalExceptionFilter } from "./global-exception.filter.js";

describe("GlobalExceptionFilter — 전역 예외 필터", () => {
  let filter: GlobalExceptionFilter;
  let logger: RecordingPinoLogger;
  let mockResponse: { status: Mock; json: Mock };
  let mockRequest: {
    method: string;
    url: string;
    route?: { path: string };
    user?: { userId: string };
  };
  let host: ExecutionContextHost;

  let messages: ErrorMessageTranslator;
  let reporter: RecordingExceptionReporter;
  let alerts: RecordingOperationalAlert;

  const createFilter = (isDevelopment = true) => {
    reporter = new RecordingExceptionReporter();
    alerts = new RecordingOperationalAlert();
    return new GlobalExceptionFilter(
      logger,
      { nodeEnv: isDevelopment ? "development" : "production" },
      messages,
      reporter,
      alerts,
    );
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppI18nModule] }).compile();
    await module.init();
    messages = module.get(ErrorMessageTranslator);
  });

  beforeEach(() => {
    logger = new RecordingPinoLogger();

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    mockRequest = {
      method: "POST",
      url: "/test/42?token=secret",
      route: { path: "/test/:id" },
    };

    host = new ExecutionContextHost([mockRequest, mockResponse]);

    filter = createFilter(true);
  });

  describe("PostgreSQL unique violation 에러 처리", () => {
    it("알려진 constraint(email)를 업무 오류으로 매핑해야 한다", () => {
      // Given
      const error = sqlQueryError("23505", "User_email_key");

      // When
      filter.catch(error, host);

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.code).toBe(ErrorCode.EMAIL_0501);
    });

    it("알 수 없는 constraint를 SYS_0004 (409)로 폴백해야 한다", () => {
      // Given
      const error = sqlQueryError("23505");

      // When
      filter.catch(error, host);

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.code).toBe(ErrorCode.SYS_0004);
      expect(logger.warnings).toContainEqual([
        { event: "database.unique-constraint.unknown", constraint: "unknown" },
      ]);
      expect(alerts.alerts).toEqual([
        expect.objectContaining({
          key: "database.unique-constraint.unknown",
          tags: { constraint: "unknown" },
        }),
      ]);
    });

    it("알려진 옛 제약은 경보 없이 업무 오류로 바꾼다", () => {
      // When
      filter.catch(sqlQueryError("23505", "User_email_key"), host);

      // Then
      expect(mockResponse.json.mock.calls[0]?.[0]?.error.code).toBe(ErrorCode.EMAIL_0501);
      expect(alerts.alerts).toEqual([]);
    });

    it("SQLSTATE 23503 FK constraint violation은 400 SYS_0002로 처리해야 한다", () => {
      // Given
      const error = sqlQueryError("23503");

      // When
      filter.catch(error, host);

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.code).toBe(ErrorCode.SYS_0002);
    });

    it.each([
      ["문장 시간 초과(57014)", sqlQueryError("57014")],
      ["잠금 대기 초과(55P03)", sqlQueryError("55P03")],
      ["연결 예외(08006)", sqlQueryError("08006")],
      ["관리자 종료(57P01)", sqlQueryError("57P01")],
      ["풀 대기 초과", new Error("timeout exceeded when trying to connect")],
    ])("일시적 DB 문제 %s는 503 SYS_0005로 처리하고 예외 보고로 보낸다", (_, error) => {
      // When
      filter.catch(error, host);

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      const body = errorEnvelopeSchema.parse(mockResponse.json.mock.calls[0]?.[0]);
      expect(body.error.code).toBe(ErrorCode.SYS_0005);
      expect(body.error.message).toBe(Errors[ErrorCode.SYS_0005].message);
      expect(reporter.reports.map((report) => report.error)).toEqual([error]);
    });

    it("처리되지 않은 DB 에러는 500 SYS_0001로 처리해야 한다", () => {
      // Given
      const error = sqlQueryError("XX000");

      // When
      filter.catch(error, host);

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.code).toBe(ErrorCode.SYS_0001);
    });
  });

  describe("기존 동작 유지", () => {
    it("업무 오류을 올바르게 처리해야 한다", () => {
      // Given
      const exception = new ApplicationException(ErrorCode.TODO_CATEGORY_0851, { categoryId: 1 });

      // When
      filter.catch(exception, host);

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(Errors[exception.errorCode].httpStatus);
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.code).toBe(ErrorCode.TODO_CATEGORY_0851);
    });

    it("HttpException을 올바르게 처리해야 한다", () => {
      // Given
      const exception = new HttpException({ message: "Bad Request" }, HttpStatus.BAD_REQUEST);

      // When
      filter.catch(exception, host);

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.code).toBe(ErrorCode.SYS_0002);
    });

    it.each([
      [
        "검증 실패(400)",
        new BadRequestException({ statusCode: 400, message: "Validation failed", errors: [] }),
        ErrorCode.SYS_0002,
      ],
      ["없는 route(404)", new NotFoundException("Cannot GET /v1/unknown"), ErrorCode.SYS_0002],
      ["허용하지 않는 method(405)", new MethodNotAllowedException(), ErrorCode.SYS_0002],
      ["문자열 응답의 4xx", new HttpException("Gone", HttpStatus.GONE), ErrorCode.SYS_0002],
      [
        "요청 한도 초과(429)",
        new HttpException("ThrottlerException: Too Many Requests", HttpStatus.TOO_MANY_REQUESTS),
        ErrorCode.SYS_0001,
      ],
      ["객체 응답의 5xx", new ServiceUnavailableException({ status: "error" }), ErrorCode.SYS_0001],
    ])("HttpException %s은 상태로 공통 코드를 정한다", (_, exception, code) => {
      // Given
      const status = exception.getStatus();

      // When
      filter.catch(exception, host);

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(status);
      const body = errorEnvelopeSchema.parse(mockResponse.json.mock.calls[0]?.[0]);
      expect(body.error.code).toBe(code);
    });

    it("알 수 없는 에러를 500 SYS_0001로 처리해야 한다", () => {
      // Given
      const exception = new Error("unexpected error");

      // When
      filter.catch(exception, host);

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.code).toBe(ErrorCode.SYS_0001);
    });
  });

  describe("예외 보고", () => {
    it("5xx 서버 에러는 요청 태그·오류 응답과 함께 보고한다", () => {
      // Given
      const exception = new Error("unexpected server error");

      // When
      filter.catch(exception, host);

      // Then
      expect(reporter.reports).toEqual([
        {
          error: exception,
          context: {
            userId: null,
            tags: {
              "http.method": "POST",
              "http.route": "/test/:id",
              "http.status_code": "500",
              "error.code": ErrorCode.SYS_0001,
            },
            extras: { errorResponse: mockResponse.json.mock.calls[0]?.[0] },
          },
        },
      ]);
    });

    it("5xx 보고에 사용자 ID만 싣고 IP는 보내지 않는다", () => {
      // Given
      mockRequest.user = { userId: "user-1" };

      // When
      filter.catch(new Error("boom"), host);
      mockRequest.user = undefined;
      filter.catch(new Error("boom"), host);

      // Then
      expect(reporter.reports.map((report) => report.context.userId)).toEqual(["user-1", null]);
      expect(JSON.stringify(reporter.reports)).not.toContain("ip_address");
    });

    it("코드로 분류해 던진 5xx는 던진 곳과 상관없이 코드별 한 묶음으로 보고한다", () => {
      // Given
      const exception = new ApplicationException(ErrorCode.AI_1301);

      // When
      filter.catch(exception, host);

      // Then
      expect(reporter.reports[0]?.context.groupKey).toBe("http-5xx.AI_1301");
    });

    it("라우팅 전에 실패한 요청은 경로 템플릿 대신 unmatched로 싣는다", () => {
      // Given
      mockRequest.route = undefined;

      // When
      filter.catch(new Error("boom"), host);

      // Then
      expect(reporter.reports[0]?.context.tags["http.route"]).toBe("unmatched");
    });

    it("4xx 클라이언트 에러는 보고하지 않는다", () => {
      // Given
      const exception = new HttpException({ message: "Bad Request" }, HttpStatus.BAD_REQUEST);

      // When
      filter.catch(exception, host);

      // Then
      expect(reporter.reports).toEqual([]);
    });

    it("업무 오류(4xx)는 보고하지 않는다", () => {
      // Given
      const exception = new ApplicationException(ErrorCode.TODO_CATEGORY_0851, { categoryId: 1 });

      // When
      filter.catch(exception, host);

      // Then
      expect(reporter.reports).toEqual([]);
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
      filter.catch(exception, host);

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
      filter.catch(exception, host);

      // Then
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.details).toBeUndefined();
    });

    it("development 환경에서 알 수 없는 에러의 details가 포함된다", () => {
      // Given
      filter = createFilter(true);
      const exception = new Error("unexpected error");

      // When
      filter.catch(exception, host);

      // Then
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.details).toBe("unexpected error");
    });

    it("production 환경에서도 친구 한도 초과는 공개 상세(current·limit·charged·featureQuota)만 싣는다", () => {
      // Given
      filter = createFilter(false);
      const featureQuota = {
        feature: "FRIEND",
        allowed: true,
        limit: 6,
        used: 6,
        remaining: 0,
        period: null,
        resetsAt: null,
        isFairUse: false,
        perUse: null,
      };
      const exception = new ApplicationException(ErrorCode.FOLLOW_0909, {
        current: 6,
        limit: 6,
        charged: false,
        featureQuota,
        userId: "user-123",
      });

      // When
      filter.catch(exception, host);

      // Then
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.details).toEqual({
        current: 6,
        limit: 6,
        charged: false,
        featureQuota,
      });
    });

    it.each([ErrorCode.AI_1301, ErrorCode.AI_1302, ErrorCode.AI_1310])(
      "production 환경에서도 환불한 AI 실패 %s는 차감 없음(charged:false)만 싣는다",
      (errorCode) => {
        // Given
        filter = createFilter(false);
        const exception = new ApplicationException(errorCode, { charged: false, provider: "x" });

        // When
        filter.catch(exception, host);

        // Then
        const jsonArg = mockResponse.json.mock.calls[0]?.[0];
        expect(jsonArg?.error.details).toEqual({ charged: false });
      },
    );

    it("production 환경에서 공개 상세가 없는 업무 오류의 details는 싣지 않는다", () => {
      // Given
      filter = createFilter(false);
      const exception = new ApplicationException(ErrorCode.USER_0601, { userId: "user-123" });

      // When
      filter.catch(exception, host);

      // Then
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error).not.toHaveProperty("details");
    });

    it("production 환경에서 알 수 없는 에러의 details가 포함되지 않는다", () => {
      // Given
      filter = createFilter(false);
      const exception = new Error("unexpected error");

      // When
      filter.catch(exception, host);

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
      const expected = new ApplicationException(ErrorCode.TODO_0801, { todoId: 1 });

      // When
      filter.catch(exception, host);

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
      filter.catch(exception, host);

      // Then
      const jsonArg = mockResponse.json.mock.calls[0]?.[0];
      expect(jsonArg?.error.code).toBe(ErrorCode.USER_0601);
      expect(jsonArg.success).toBe(false);
    });

    it("커스텀 메시지가 있는 DomainException은 메시지를 보존한다", () => {
      // Given
      const exception = new DomainException(ErrorCode.TODO_0801, undefined, "커스텀 도메인 메시지");

      // When
      filter.catch(exception, host);

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
      filter.catch(exception, host);

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
    filter.catch(exception, host);

    // Then
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: ErrorCode.SYS_0001, details: exception.message }),
      }),
    );
    expect(logger.errors).toContainEqual([
      expect.objectContaining({
        event: "http.request.failed",
        path: "/oauth/callback",
        statusCode: 500,
        errorType: "Error",
      }),
      "HTTP 요청 실패",
    ]);
    const recorded = JSON.stringify(logger.errors);
    for (const secret of ["secret-code", "secret-state", "secret-token"]) {
      expect(recorded).not.toContain(secret);
    }
  });

  describe("공유 errorEnvelopeSchema 계약", () => {
    const exceptions = {
      업무_오류: () => new ApplicationException(ErrorCode.SYS_0002, { reason: "invalid" }),
      HttpException: () => new HttpException({ message: ["a", "b"] }, HttpStatus.BAD_REQUEST),
      알_수_없는_에러: () => new Error("boom"),
      데이터베이스_에러: () => sqlQueryError("23505", "User_email_key"),
    };

    it.each(Object.entries(exceptions))("%s 응답이 envelope 스키마를 만족한다", (_name, create) => {
      for (const isDevelopment of [true, false]) {
        createFilter(isDevelopment).catch(create(), host);
        const body = mockResponse.json.mock.lastCall?.[0];
        expect(errorEnvelopeSchema.safeParse(body).success).toBe(true);
      }
    });
  });
});
