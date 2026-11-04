import { Logger } from "@nestjs/common";
import { vi } from "vitest";

import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { RecordingOperationalAlert } from "#test/mocks/recording-operational-alert";
import {
  resendResponseFixture,
  StubResendHttp,
  type HttpResponseStep,
} from "#test/mocks/resend-http.stub";

import { createVerificationCodeEmail } from "../../../application/services/email/email-message.factory.js";
import { EmailLogEvent } from "../../observability/email/email-log.events.js";
import {
  describeEmailSenderContract,
  type EmailContractScenario,
} from "./email-sender.contract.js";
import { ResendEmailSenderAdapter } from "./resend-email-sender.adapter.js";

const recipient = "private@example.com";
const verificationCode = "987654";
const message = (idempotencyKey?: string) =>
  createVerificationCodeEmail(
    recipient,
    { code: verificationCode, expiryMinutes: 15 },
    idempotencyKey,
  );

const success = resendResponseFixture("send.success.json");
const unavailable = resendResponseFixture("send.application-error.json", 500);
const rateLimited = resendResponseFixture("send.rate-limit.json", 429);

const SCENARIO_RESPONSES: Record<EmailContractScenario, HttpResponseStep> = {
  success,
  unavailable,
  "rate-limited": rateLimited,
  "daily-quota": resendResponseFixture("send.daily-quota.json", 429),
  "monthly-quota": resendResponseFixture("send.monthly-quota.json", 429),
  rejected: resendResponseFixture("send.validation-error.json", 422),
  unreachable: () => {
    throw new TypeError("Network connection failed");
  },
};

describe("ResendEmailSenderAdapter", () => {
  let http: StubResendHttp;
  let alerts: RecordingOperationalAlert;

  function adapter(apiKey: string | null = "test-key"): ResendEmailSenderAdapter {
    alerts = new RecordingOperationalAlert();
    return new ResendEmailSenderAdapter(
      { apiKey, from: "noreply@example.com", fromName: "Aido", environment: "test" },
      new OutboundPolicyRegistry(alerts),
    );
  }

  function givenResponses(responses: readonly HttpResponseStep[]): void {
    http = new StubResendHttp(responses);
    vi.stubGlobal("fetch", http.fetch);
  }

  beforeEach(() => {
    vi.stubEnv("RESEND_BASE_URL", "https://api.resend.com");
    givenResponses([]);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describeEmailSenderContract({
    scenarios: [
      "success",
      "unavailable",
      "rate-limited",
      "daily-quota",
      "monthly-quota",
      "rejected",
      "unreachable",
    ],
    arrange: (scenario) => {
      givenResponses([SCENARIO_RESPONSES[scenario]]);
      return adapter();
    },
    forwardedIdempotencyKeys: () =>
      http.requests.map((request) => request.headers.get("idempotency-key")),
    cleanup: () => {
      expect(http.unexpectedRequests).toEqual([]);
      expect(http.remainingResponses).toBe(0);
    },
  });

  it("성공 응답의 messageId를 돌려주고 설정·본문·환경 태그를 실제 요청에 싣는다", async () => {
    // Given
    givenResponses([success]);

    // When
    const outcome = await adapter().send(message());

    // Then
    expect(outcome).toEqual({ status: "sent", providerMessageId: "fixture-message" });
    expect(http.request().headers.get("authorization")).toBe("Bearer test-key");
    expect(await http.request().json()).toEqual(
      expect.objectContaining({
        from: "Aido <noreply@example.com>",
        to: recipient,
        subject: "[아이두] 이메일 인증 코드",
        text: expect.stringContaining(verificationCode),
        tags: [
          { name: "type", value: "verification" },
          { name: "environment", value: "test" },
        ],
      }),
    );
  });

  it("멱등 키가 없으면 요청 헤더에도 싣지 않는다", async () => {
    // Given
    givenResponses([success]);

    // When
    await adapter().send(message());

    // Then
    expect(http.request().headers.has("idempotency-key")).toBe(false);
  });

  it("실패해도 한 번만 시도하고 다시 보내지 않는다", async () => {
    // Given
    givenResponses([unavailable]);

    // When
    await adapter().send(message());

    // Then
    expect(http.requests).toHaveLength(1);
  });

  it("API 키가 없으면 호출 없이 재시도 불가 not_configured로 끝낸다", async () => {
    // Given
    const sender = adapter(null);

    // When
    const outcome = await sender.send(message());

    // Then
    expect(outcome).toEqual({ status: "failed", reason: "not_configured", retryable: false });
    expect(http.requests).toHaveLength(0);
  });

  it("모르는 오류 이름은 거절로 보고 로그에 오류 이름·수신자·원문을 남기지 않는다", async () => {
    // Given
    const secret = `${recipient}:${verificationCode}:synthetic-private-key`;
    givenResponses([
      () =>
        new Response(JSON.stringify({ name: secret, message: secret }), {
          status: 422,
          headers: { "content-type": "application/json" },
        }),
    ]);

    // When
    const outcome = await adapter().send(message());

    // Then
    expect(outcome).toEqual({ status: "failed", reason: "rejected", retryable: false });
    expect(Logger.prototype.error).toHaveBeenCalledWith({
      event: EmailLogEvent.DELIVERY_FAILED,
      reason: "rejected",
      retryable: false,
    });
    expect(JSON.stringify(vi.mocked(Logger.prototype.error).mock.calls)).not.toContain(secret);
  });

  it("응답이 없으면 10초 뒤 기다리기를 멈추고 재시도 가능한 unavailable로 끝낸다", async () => {
    // Given
    vi.useFakeTimers();
    givenResponses([() => new Promise<Response>(() => undefined)]);
    const sender = adapter();

    // When
    const pending = sender.send(message());
    await vi.advanceTimersByTimeAsync(10_000);
    const outcome = await pending;

    // Then
    expect(outcome).toEqual({ status: "failed", reason: "unavailable", retryable: true });
  });

  it("공급자 장애가 연속 5번이면 회로를 열어 다음 메일은 호출 없이 unavailable로 끝내고 경보를 올린다", async () => {
    // Given
    givenResponses(Array.from({ length: 5 }, () => unavailable));
    const sender = adapter();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await sender.send(message());
    }

    // When
    const outcome = await sender.send(message());

    // Then
    expect(outcome).toEqual({ status: "failed", reason: "unavailable", retryable: true });
    expect(http.requests).toHaveLength(5);
    expect(alerts.alerts).toEqual([
      expect.objectContaining({ key: "notification.email.circuit-open", severity: "error" }),
    ]);
  });

  it("429·검증 거절은 공급자 전체 장애로 세지 않아 회로가 열리지 않는다", async () => {
    // Given
    givenResponses(Array.from({ length: 5 }, () => rateLimited));
    const sender = adapter();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await sender.send(message());
    }
    givenResponses([success]);

    // When
    const outcome = await sender.send(message());

    // Then
    expect(outcome.status).toBe("sent");
  });
});
