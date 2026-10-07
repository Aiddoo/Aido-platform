import { Test, type TestingModule } from "@nestjs/testing";
import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { EMAIL_CONSTANTS } from "#api/modules/notification/infrastructure/constants/email/email.constants";
import { EmailModule } from "#api/modules/notification/notification-email.module";
import { TransactionalEmailSender } from "#api/modules/notification/notification-email.public";
import { AppConfigModule } from "#api/platform/config/config.module";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { resendResponseFixture, StubResendHttp } from "#test/mocks/resend-http.stub";
import { suppressLogger } from "#test/setup/suppress-logger";

const recipient = "private@example.com";
const code = "987654";
const expiryMinutes = 15;
const success = () => resendResponseFixture("send.success.json");
const failure = () => resendResponseFixture("send.application-error.json", 500);

describe("TransactionalEmailSender 통합 테스트 — 실제 SDK + HTTP fixture", () => {
  let module: TestingModule;
  let sender: TransactionalEmailSender;
  let http: StubResendHttp;

  beforeEach(async () => {
    suppressLogger();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T00:00:00Z"));
    vi.stubEnv("RESEND_BASE_URL", "https://api.resend.com");
    givenResponses([]);
    module = await Test.createTestingModule({ imports: [AppConfigModule, EmailModule] })
      .overrideProvider(TypedConfigService)
      .useValue(
        mock<TypedConfigService>({
          email: {
            isConfigured: true,
            apiKey: "fixture-api-key",
            from: "noreply@integration-test.com",
            fromName: "Integration Test",
            supportEmail: "support@example.com",
          },
          nodeEnv: "test",
        }),
      )
      .compile();
    sender = module.get(TransactionalEmailSender);
  });

  afterEach(async () => {
    try {
      await module?.close();
      expect(http.unexpectedRequests).toEqual([]);
      expect(http.remainingResponses).toBe(0);
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });

  function givenResponses(responses: ConstructorParameters<typeof StubResendHttp>[0]): void {
    http = new StubResendHttp(responses);
    vi.stubGlobal("fetch", http.fetch);
  }

  async function sendVerificationCode(idempotencyKey?: string) {
    const pending = sender.sendVerificationCode(recipient, { code, expiryMinutes }, idempotencyKey);
    await vi.runAllTimersAsync();
    return pending;
  }

  it("운영 EmailModule 배선으로 설정·인증·템플릿을 실제 HTTP 요청에 전달한다", async () => {
    // Given
    givenResponses([success()]);

    // When
    const result = await sendVerificationCode();

    // Then
    expect(result).toEqual({ success: true, messageId: "fixture-message", retryCount: 0 });
    expect(http.request().headers.get("authorization")).toBe("Bearer fixture-api-key");
    expect(http.request().headers.get("content-type")).toBe("application/json");
    const body = await http.request().json();
    expect(body).toEqual(
      expect.objectContaining({
        from: "Integration Test <noreply@integration-test.com>",
        to: recipient,
        subject: "[Aido] 이메일 인증 코드",
        html: expect.stringContaining(code),
        text: expect.stringContaining(String(expiryMinutes)),
        tags: [
          { name: "type", value: "verification" },
          { name: "environment", value: "test" },
        ],
      }),
    );
    expect(body).toEqual(
      expect.objectContaining({
        html: expect.stringContaining(String(expiryMinutes)),
        text: expect.stringContaining(code),
      }),
    );
  });

  it("서버 오류 후 성공하면 동일한 요청을 재시도하고 결과를 반환한다", async () => {
    // Given
    givenResponses([failure(), success()]);

    // When
    const result = await sendVerificationCode();

    // Then
    expect(result).toEqual({ success: true, messageId: "fixture-message", retryCount: 1 });
    expect(http.requests).toHaveLength(2);
    expect(await http.request(0).json()).toEqual(await http.request(1).json());
  });

  it("서버 오류와 429가 연속되면 최대 재시도 내에서 성공한다", async () => {
    // Given
    givenResponses([
      failure(),
      resendResponseFixture("send.rate-limit.json", 429),
      failure(),
      success(),
    ]);

    // When
    const result = await sendVerificationCode();

    // Then
    expect(result.retryCount).toBe(3);
    expect(result.success).toBe(true);
    expect(http.requests).toHaveLength(4);
  });

  it("최대 재시도 횟수까지 실패하면 공급자 오류를 반환한다", async () => {
    // Given
    givenResponses(Array.from({ length: EMAIL_CONSTANTS.MAX_RETRIES + 1 }, failure));
    const startedAt = Date.now();

    // When
    const result = await sendVerificationCode();

    // Then
    expect(result).toEqual({
      success: false,
      error: "Persistent failure",
      retryCount: EMAIL_CONSTANTS.MAX_RETRIES,
    });
    expect(http.requests).toHaveLength(EMAIL_CONSTANTS.MAX_RETRIES + 1);
    expect(Date.now() - startedAt).toBe(
      EMAIL_CONSTANTS.BASE_RETRY_DELAY * (2 ** EMAIL_CONSTANTS.MAX_RETRIES - 1),
    );
  });

  it("validation_error는 재시도 없이 실패한다", async () => {
    // Given
    givenResponses([resendResponseFixture("send.validation-error.json", 422)]);

    // When
    const result = await sendVerificationCode();

    // Then
    expect(result).toEqual({
      success: false,
      error: `Rejected ${recipient}: ${code}`,
      retryCount: 0,
    });
    expect(http.requests).toHaveLength(1);
  });

  it("연결 실패는 실제 SDK가 정규화한 오류를 재시도한 뒤 반환한다", async () => {
    // Given
    givenResponses(
      Array.from({ length: EMAIL_CONSTANTS.MAX_RETRIES + 1 }, () => () => {
        throw new TypeError("Network connection failed");
      }),
    );

    // When
    const result = await sendVerificationCode();

    // Then
    expect(result).toEqual({
      success: false,
      error: "Unable to fetch data. The request could not be resolved.",
      retryCount: EMAIL_CONSTANTS.MAX_RETRIES,
    });
    expect(http.requests).toHaveLength(EMAIL_CONSTANTS.MAX_RETRIES + 1);
  });

  it("JSON이 아닌 서버 오류도 SDK 정규화와 재시도를 거쳐 복구한다", async () => {
    // Given
    givenResponses([() => new Response("Bad gateway", { status: 502 }), success()]);

    // When
    const result = await sendVerificationCode();

    // Then
    expect(result.success).toBe(true);
    expect(result.retryCount).toBe(1);
  });

  it("재시도마다 Idempotency Key를 HTTP 헤더에 유지한다", async () => {
    // Given
    givenResponses([failure(), success()]);
    const idempotencyKey = "fixture-request-12345";

    // When
    await sendVerificationCode(idempotencyKey);

    // Then
    expect(http.requests).toHaveLength(2);
    for (const request of http.requests) {
      expect(request.headers.get("idempotency-key")).toBe(idempotencyKey);
      expect(await request.json()).not.toHaveProperty("headers.Idempotency-Key");
    }
  });

  it("Idempotency Key가 없으면 HTTP 헤더에도 포함하지 않는다", async () => {
    // Given
    givenResponses([success()]);

    // When
    await sendVerificationCode();

    // Then
    expect(http.request().headers.has("idempotency-key")).toBe(false);
  });

  it("동시에 발송한 이메일의 Idempotency Key와 본문을 각각 유지한다", async () => {
    // Given
    givenResponses([success(), success()]);

    // When
    const results = await Promise.all([
      sender.sendVerificationCode(recipient, { code, expiryMinutes }, "verification-request"),
      sender.sendPasswordResetCode(
        "another@example.com",
        { code: "123456", expiryMinutes },
        "reset-request",
      ),
    ]);

    // Then
    expect(results.every((result) => result.success)).toBe(true);
    expect(http.requests).toHaveLength(2);
    const deliveredRequests = await Promise.all(
      http.requests.map(async (request) => ({
        idempotencyKey: request.headers.get("idempotency-key"),
        body: await request.json(),
      })),
    );
    expect(deliveredRequests).toEqual(
      expect.arrayContaining([
        {
          idempotencyKey: "verification-request",
          body: expect.objectContaining({ to: recipient, text: expect.stringContaining(code) }),
        },
        {
          idempotencyKey: "reset-request",
          body: expect.objectContaining({
            to: "another@example.com",
            text: expect.stringContaining("123456"),
          }),
        },
      ]),
    );
  });

  it.each([
    ["비밀번호 재설정", "sendPasswordResetCode", "password-reset"],
    ["비밀번호 설정", "sendPasswordSetupCode", "password-setup"],
  ] as const)("%s 템플릿과 환경 태그를 요청에 전달한다", async (_description, method, type) => {
    // Given
    givenResponses([success()]);

    // When
    await sender[method](recipient, { code, expiryMinutes });

    // Then
    const body = await http.request().json();
    expect(body).toEqual(
      expect.objectContaining({
        to: recipient,
        html: expect.stringContaining(code),
        text: expect.stringContaining(String(expiryMinutes)),
        tags: [
          { name: "type", value: type },
          { name: "environment", value: "test" },
        ],
      }),
    );
    expect(body).toEqual(
      expect.objectContaining({
        html: expect.stringContaining(String(expiryMinutes)),
        text: expect.stringContaining(code),
      }),
    );
  });
});
