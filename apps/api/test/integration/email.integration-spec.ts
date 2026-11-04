import { Global, Module } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { EmailDeliveryQueueProcessor } from "#api/modules/notification/infrastructure/jobs/email/email-delivery-queue.processor";
import { NotificationEmailModule } from "#api/modules/notification/notification-email.module";
import { TransactionalEmailSender } from "#api/modules/notification/notification-email.public";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { EncryptionService } from "#api/platform/encryption/encryption.service";
import { InMemoryUsageMeterAdapter } from "#api/platform/metering/adapters/in-memory-usage-meter.adapter";
import { USAGE_METER } from "#api/platform/metering/interfaces/usage-meter.interface";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { JOB_RUNTIME } from "#api/shared/application/ports/job-runtime.port";
import { OPERATIONAL_ALERT } from "#api/shared/application/ports/operational-alert.port";
import { FakeJobRuntime } from "#test/mocks/fake-job-runtime";
import { RecordingOperationalAlert } from "#test/mocks/recording-operational-alert";
import {
  type HttpResponseStep,
  resendResponseFixture,
  StubResendHttp,
} from "#test/mocks/resend-http.stub";
import { suppressLogger } from "#test/setup/suppress-logger";

const recipient = "private@example.com";
const code = "987654";
const expiryMinutes = 15;
const success = resendResponseFixture("send.success.json");
const unavailable = resendResponseFixture("send.application-error.json", 500);

const config = mock<TypedConfigService>({
  email: {
    provider: "resend",
    apiKey: "fixture-api-key",
    from: "noreply@integration-test.com",
    fromName: "Integration Test",
    supportEmail: "support@example.com",
  },
  nodeEnv: "test",
  tokenEncryptionKey: "test-token-encryption-key-minimum-32-characters-long",
  tokenEncryptionSalt: undefined,
});
const runtime = new FakeJobRuntime();
const meter = new InMemoryUsageMeterAdapter();
const alerts = new RecordingOperationalAlert();

@Global()
@Module({
  providers: [
    { provide: TypedConfigService, useValue: config },
    { provide: JOB_RUNTIME, useValue: runtime },
    { provide: USAGE_METER, useValue: meter },
    { provide: OPERATIONAL_ALERT, useValue: alerts },
    OutboundPolicyRegistry,
    EncryptionService,
  ],
  exports: [
    TypedConfigService,
    JOB_RUNTIME,
    USAGE_METER,
    OPERATIONAL_ALERT,
    OutboundPolicyRegistry,
    EncryptionService,
  ],
})
class PlatformStubModule {}

describe("이메일 발송 큐 통합 테스트 — 운영 NotificationEmailModule 배선 + 실제 Resend SDK + HTTP fixture", () => {
  let module: TestingModule;
  let sender: TransactionalEmailSender;
  let processor: EmailDeliveryQueueProcessor;
  let http: StubResendHttp;

  beforeEach(async () => {
    suppressLogger();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("RESEND_BASE_URL", "https://api.resend.com");
    givenResponses([]);
    runtime.enqueueCalls.length = 0;
    alerts.alerts.length = 0;
    module = await Test.createTestingModule({
      imports: [PlatformStubModule, NotificationEmailModule],
    }).compile();
    sender = module.get(TransactionalEmailSender);
    processor = module.get(EmailDeliveryQueueProcessor);
  });

  afterEach(async () => {
    try {
      await module?.close();
      expect(http.unexpectedRequests).toEqual([]);
      expect(http.remainingResponses).toBe(0);
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    }
  });

  function givenResponses(responses: readonly HttpResponseStep[]): void {
    http = new StubResendHttp(responses);
    vi.stubGlobal("fetch", http.fetch);
  }

  async function runQueuedJob(attempt = 1): Promise<void> {
    const job = runtime.enqueueCalls.at(-1);
    if (job == null) {
      throw new Error("큐에 담긴 잡이 없습니다");
    }
    await processor.process(attempt, job.data);
  }

  it("요청 경로에서는 HTTP 호출 없이 큐에만 담고 queued로 답한다", async () => {
    // Given
    givenResponses([]);

    // When
    const result = await sender.sendVerificationCode(recipient, { code, expiryMinutes });

    // Then
    expect(result).toEqual({ status: "queued" });
    expect(http.requests).toHaveLength(0);
    expect(runtime.enqueueCalls).toHaveLength(1);
    expect(JSON.stringify(runtime.enqueueCalls[0]?.data)).not.toContain(code);
    expect(JSON.stringify(runtime.enqueueCalls[0]?.data)).not.toContain(recipient);
  });

  it("worker가 설정·인증·템플릿을 실제 HTTP 요청에 전달한다", async () => {
    // Given
    givenResponses([success]);
    await sender.sendVerificationCode(recipient, { code, expiryMinutes });

    // When
    await runQueuedJob();

    // Then
    expect(http.request().headers.get("authorization")).toBe("Bearer fixture-api-key");
    expect(http.request().headers.get("content-type")).toBe("application/json");
    expect(await http.request().json()).toEqual(
      expect.objectContaining({
        from: "Integration Test <noreply@integration-test.com>",
        to: recipient,
        subject: "[아이두] 이메일 인증 코드",
        html: expect.stringContaining(code),
        text: expect.stringContaining(String(expiryMinutes)),
        tags: [
          { name: "type", value: "verification" },
          { name: "environment", value: "test" },
        ],
      }),
    );
  });

  it("일시 장애는 큐 재시도를 위해 던지고 같은 멱등 키·본문으로 다시 보내 성공한다", async () => {
    // Given
    givenResponses([unavailable, success]);
    await sender.sendVerificationCode(recipient, { code, expiryMinutes });

    // When
    const firstAttempt = runQueuedJob(1);
    await expect(firstAttempt).rejects.toThrow("Email delivery failed");
    await runQueuedJob(2);

    // Then
    expect(http.requests).toHaveLength(2);
    const [first, second] = http.requests;
    expect(first?.headers.get("idempotency-key")).toBe(second?.headers.get("idempotency-key"));
    expect(first?.headers.get("idempotency-key")).toMatch(/^[0-9a-f-]{36}$/);
    expect(await first?.json()).toEqual(await second?.json());
    expect(alerts.alerts).toEqual([]);
  });

  it("검증 거절은 재시도 없이 예산을 돌려주고 운영 경보를 올린다", async () => {
    // Given
    givenResponses([resendResponseFixture("send.validation-error.json", 422)]);
    await sender.sendVerificationCode(recipient, { code, expiryMinutes });

    // When
    await runQueuedJob();

    // Then
    expect(http.requests).toHaveLength(1);
    expect(alerts.alerts).toEqual([
      expect.objectContaining({ key: "notification.email.delivery-rejected" }),
    ]);
    expect(JSON.stringify(alerts.alerts)).not.toContain(recipient);
    expect(JSON.stringify(alerts.alerts)).not.toContain(code);
  });

  it("재시도를 다 쓴 마지막 시도는 던지지 않고 경보를 올려 잡이 끝난다", async () => {
    // Given
    givenResponses([unavailable]);
    await sender.sendVerificationCode(recipient, { code, expiryMinutes });

    // When
    await runQueuedJob(5);

    // Then
    expect(alerts.alerts).toEqual([
      expect.objectContaining({ key: "notification.email.delivery-retry-exhausted" }),
    ]);
  });

  it.each([
    ["비밀번호 재설정", "sendPasswordResetCode", "password-reset"],
    ["비밀번호 설정", "sendPasswordSetupCode", "password-setup"],
  ] as const)("%s 템플릿과 환경 태그를 요청에 전달한다", async (_description, method, type) => {
    // Given
    givenResponses([success]);
    await sender[method](recipient, { code, expiryMinutes });

    // When
    await runQueuedJob();

    // Then
    expect(await http.request().json()).toEqual(
      expect.objectContaining({
        to: recipient,
        html: expect.stringContaining(code),
        tags: [
          { name: "type", value: type },
          { name: "environment", value: "test" },
        ],
      }),
    );
  });
});
