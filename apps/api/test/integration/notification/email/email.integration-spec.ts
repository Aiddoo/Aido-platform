import { Global, Module } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { vi } from "vitest";

import { EmailDeliveryQueueProcessor } from "#api/modules/notification/email/infrastructure/jobs/email-delivery-queue.processor";
import { EMAIL_DELIVERY_QUEUE } from "#api/modules/notification/email/infrastructure/jobs/email-delivery.queue";
import { notificationEmailConfig } from "#api/modules/notification/email/notification-email.config";
import { NotificationEmailModule } from "#api/modules/notification/email/notification-email.module";
import { SendTransactionalEmailUseCase } from "#api/modules/notification/notification-email.public";
import { EncryptionService } from "#api/platform/encryption/encryption.service";
import { USAGE_METER } from "#api/platform/metering/interfaces/usage-meter.interface";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import {
  OPERATIONAL_ALERT,
  OperationalAlertPort,
} from "#api/shared/application/ports/operational-alert.port";
import { DateClock } from "#test/doubles/platform/date-clock";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import { InMemoryUsageMeterAdapter } from "#test/mocks/in-memory-usage-meter.adapter";
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

const jobQueue = new InMemoryJobQueue();
const meter = new InMemoryUsageMeterAdapter();
const alerts = new RecordingOperationalAlert();

@Global()
@Module({
  providers: [
    { provide: JobQueuePort, useValue: jobQueue },
    { provide: USAGE_METER, useValue: meter },
    { provide: OPERATIONAL_ALERT, useValue: alerts },
    { provide: OperationalAlertPort, useValue: alerts },
    { provide: ClockPort, useClass: DateClock },
    OutboundPolicyRegistry,
    {
      provide: EncryptionService,
      useValue: new EncryptionService({
        key: "test-token-encryption-key-minimum-32-characters-long",
        salt: undefined,
      }),
    },
  ],
  exports: [
    JobQueuePort,
    USAGE_METER,
    OPERATIONAL_ALERT,
    OperationalAlertPort,
    ClockPort,
    OutboundPolicyRegistry,
    EncryptionService,
  ],
})
class PlatformStubModule {}

describe("이메일 발송 큐 통합 테스트 — 운영 NotificationEmailModule 배선 + @nestjs/mail ResendTransport + HTTP fixture", () => {
  let module: TestingModule;
  let sender: SendTransactionalEmailUseCase;
  let processor: EmailDeliveryQueueProcessor;
  let http: StubResendHttp;

  beforeEach(async () => {
    suppressLogger();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    givenResponses([]);
    jobQueue.clear();
    alerts.alerts.length = 0;
    module = await Test.createTestingModule({
      imports: [PlatformStubModule, NotificationEmailModule],
    })
      .overrideProvider(notificationEmailConfig.KEY)
      .useValue({
        provider: "resend",
        apiKey: "fixture-api-key",
        from: "noreply@integration-test.com",
        fromName: "Integration Test",
      })
      .compile();
    sender = module.get(SendTransactionalEmailUseCase);
    processor = module.get(EmailDeliveryQueueProcessor);
  });

  afterEach(async () => {
    try {
      await module?.close();
      expect(http.unexpectedRequests).toEqual([]);
      expect(http.remainingResponses).toBe(0);
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });

  function givenResponses(responses: readonly HttpResponseStep[]): void {
    http = new StubResendHttp(responses);
    vi.stubGlobal("fetch", http.fetch);
  }

  async function runQueuedJob(attempt = 1): Promise<void> {
    const job = jobQueue.jobsIn(EMAIL_DELIVERY_QUEUE).at(-1);
    if (job == null) {
      throw new Error("큐에 담긴 잡이 없습니다");
    }
    await processor.process(attempt, EMAIL_DELIVERY_QUEUE.payloadSchema.parse(job.payload));
  }

  it("요청 경로에서는 HTTP 호출 없이 큐에만 담고 queued로 답한다", async () => {
    // Given
    givenResponses([]);

    // When
    const result = await sender.sendVerificationCode(recipient, { code, expiryMinutes });

    // Then
    expect(result).toEqual({ status: "queued" });
    expect(http.requests).toHaveLength(0);
    const queued = jobQueue.jobsIn(EMAIL_DELIVERY_QUEUE);
    expect(queued).toHaveLength(1);
    expect(JSON.stringify(queued[0]?.payload)).not.toContain(code);
    expect(JSON.stringify(queued[0]?.payload)).not.toContain(recipient);
  });

  it("worker가 설정·인증·템플릿 파일로 렌더한 본문을 실제 HTTP 요청에 전달한다", async () => {
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
        to: [recipient],
        subject: "[아이두] 이메일 인증 코드",
        html: expect.stringContaining(code),
        text: expect.stringContaining(String(expiryMinutes)),
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
    ["비밀번호 재설정", "sendPasswordResetCode", "[아이두] 비밀번호 재설정 코드"],
    ["비밀번호 설정", "sendPasswordSetupCode", "[아이두] 비밀번호 설정 인증 코드"],
  ] as const)("%s 템플릿을 요청에 전달한다", async (_description, method, subject) => {
    // Given
    givenResponses([success]);
    await sender[method](recipient, { code, expiryMinutes });

    // When
    await runQueuedJob();

    // Then
    expect(await http.request().json()).toEqual(
      expect.objectContaining({
        to: [recipient],
        subject,
        html: expect.stringContaining(code),
      }),
    );
  });

  describe("문의 — 요청 안에서 동기 발송", () => {
    const inquiry = {
      userEmail: "user@example.com",
      category: "OTHER",
      categoryLabel: "기타",
      content: "문의 내용",
      submittedAt: "2026-07-11 14:30 (KST)",
    } as const;

    it("큐를 거치지 않고 실제 HTTP 요청으로 바로 보내 sent로 답한다", async () => {
      // Given
      givenResponses([success]);

      // When
      const result = await sender.sendInquiry("support@example.com", inquiry);

      // Then
      expect(result).toEqual({ status: "sent" });
      expect(jobQueue.jobs).toHaveLength(0);
      expect(await http.request().json()).toEqual(
        expect.objectContaining({
          to: ["support@example.com"],
          subject: expect.stringContaining("기타"),
        }),
      );
    });

    it("공급자 장애는 재시도 없이 한 번만 보내고 rejected로 돌려주며 큐에도 남기지 않는다", async () => {
      // Given
      givenResponses([unavailable]);

      // When
      const result = await sender.sendInquiry("support@example.com", inquiry);

      // Then
      expect(result).toEqual({ status: "rejected", reason: "delivery_failed" });
      expect(http.requests).toHaveLength(1);
      expect(jobQueue.jobs).toHaveLength(0);
    });
  });
});
