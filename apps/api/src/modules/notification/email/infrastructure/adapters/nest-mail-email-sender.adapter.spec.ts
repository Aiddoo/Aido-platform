import { Logger } from "@nestjs/common";
import {
  InMemoryMailTransport,
  MailConnectionError,
  type MailError,
  MailMessageError,
  MailProviderError,
  ResendTransport,
} from "@nestjs/mail";
import { vi } from "vitest";

import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { createTestMailer, type TestMailer } from "#test/doubles/notification/test-mailer";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import {
  createEmailMessageFixture,
  EMAIL_MESSAGE_FIXTURE_CODE,
  EMAIL_MESSAGE_FIXTURE_RECIPIENT,
} from "#test/fixtures/notification/email-message.fixture";
import {
  type HttpResponseStep,
  resendResponseFixture,
  StubResendHttp,
} from "#test/mocks/resend-http.stub";

import type { EmailDeliveryOutcome } from "../../application/ports/email-sender.port.js";
import { EmailLogEvent } from "./email-provider.log-events.js";
import {
  describeEmailSenderContract,
  type EmailContractScenario,
} from "./email-sender-contract.adapter.js";
import { NestMailEmailSenderAdapter } from "./nest-mail-email-sender.adapter.js";

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

describe("NestMailEmailSenderAdapter — ResendTransport 원문 fixture", () => {
  let http = new StubResendHttp([]);
  let alerts: RecordingOperationalAlert;
  let resend: TestMailer;

  function adapter(isConfigured = true): NestMailEmailSenderAdapter {
    alerts = new RecordingOperationalAlert();
    return new NestMailEmailSenderAdapter({
      mailer: resend.mailer,
      policies: new OutboundPolicyRegistry(alerts),
      isConfigured,
    });
  }

  function givenResponses(responses: readonly HttpResponseStep[]): void {
    http = new StubResendHttp(responses);
  }

  beforeAll(async () => {
    // 모듈 기본 재시도를 켜 두어 어댑터가 send마다 재시도를 끄는지 본다
    resend = await createTestMailer(
      new ResendTransport({ apiKey: "test-key", fetch: (input, init) => http.fetch(input, init) }),
      3,
    );
  });

  afterAll(async () => {
    await resend.close();
  });

  beforeEach(() => {
    givenResponses([]);
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("성공 응답의 id를 돌려주고 설정의 발신자·본문을 실제 요청에 싣는다", async () => {
    // Given
    givenResponses([success]);

    // When
    const outcome = await adapter().send(createEmailMessageFixture());

    // Then
    expect(outcome).toEqual({ status: "sent", providerMessageId: "fixture-message" });
    expect(http.request().headers.get("authorization")).toBe("Bearer test-key");
    expect(await http.request().json()).toEqual(
      expect.objectContaining({
        from: "Aido <noreply@example.com>",
        to: [EMAIL_MESSAGE_FIXTURE_RECIPIENT],
        subject: "인증 코드",
        html: `<p>${EMAIL_MESSAGE_FIXTURE_CODE}</p>`,
        text: EMAIL_MESSAGE_FIXTURE_CODE,
      }),
    );
  });

  it("큐에서 꺼낸 메시지의 deliveryId를 공급자 멱등 키로 보낸다", async () => {
    // Given
    givenResponses([success]);

    // When
    await adapter().send(createEmailMessageFixture({ idempotencyKey: "delivery-1" }));

    // Then
    expect(http.request().headers.get("idempotency-key")).toBe("delivery-1");
  });

  it("멱등 키가 없으면 요청 헤더에도 싣지 않는다", async () => {
    // Given
    givenResponses([success]);

    // When
    await adapter().send(createEmailMessageFixture());

    // Then
    expect(http.request().headers.has("idempotency-key")).toBe(false);
  });

  it("모듈 재시도가 켜져 있어도 일시 장애를 한 번만 시도하고 다시 보내지 않는다", async () => {
    // Given
    givenResponses([unavailable]);

    // When
    const outcome = await adapter().send(createEmailMessageFixture());

    // Then
    expect(outcome).toEqual({ status: "failed", reason: "unavailable", retryable: true });
    expect(http.requests).toHaveLength(1);
  });

  it("API 키가 없으면 호출 없이 재시도 불가 not_configured로 끝낸다", async () => {
    // When
    const outcome = await adapter(false).send(createEmailMessageFixture());

    // Then
    expect(outcome).toEqual({ status: "failed", reason: "not_configured", retryable: false });
    expect(http.requests).toHaveLength(0);
  });

  it("모르는 오류 이름은 거절로 보고 로그에 오류 이름·수신자·원문을 남기지 않는다", async () => {
    // Given
    const secret = `${EMAIL_MESSAGE_FIXTURE_RECIPIENT}:${EMAIL_MESSAGE_FIXTURE_CODE}:synthetic-private-key`;
    givenResponses([
      () =>
        new Response(JSON.stringify({ name: secret, message: secret }), {
          status: 422,
          headers: { "content-type": "application/json" },
        }),
    ]);

    // When
    const outcome = await adapter().send(createEmailMessageFixture());

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
    // 실제 fetch처럼 끊기 전까지 응답하지 않고, 끊기면 그 이유로 실패한다
    givenResponses([
      (request) =>
        new Promise<Response>((_resolve, reject) => {
          request.signal.addEventListener("abort", () => reject(request.signal.reason));
        }),
    ]);
    const sender = adapter();

    // When
    const pending = sender.send(createEmailMessageFixture());
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
      await sender.send(createEmailMessageFixture());
    }

    // When
    const outcome = await sender.send(createEmailMessageFixture());

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
      await sender.send(createEmailMessageFixture());
    }
    givenResponses([success]);

    // When
    const outcome = await sender.send(createEmailMessageFixture());

    // Then
    expect(outcome.status).toBe("sent");
  });
});

describe("NestMailEmailSenderAdapter — InMemoryMailTransport", () => {
  let transport: InMemoryMailTransport;
  let testMailer: TestMailer;
  let sender: NestMailEmailSenderAdapter;

  beforeAll(async () => {
    transport = new InMemoryMailTransport();
    testMailer = await createTestMailer(transport);
  });

  afterAll(async () => {
    await testMailer.close();
  });

  beforeEach(() => {
    transport.clear();
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    sender = new NestMailEmailSenderAdapter({
      mailer: testMailer.mailer,
      policies: new OutboundPolicyRegistry(new RecordingOperationalAlert()),
      isConfigured: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("렌더된 제목·본문 그대로 수신자에게 한 통 보낸다", async () => {
    // When
    const outcome = await sender.send(createEmailMessageFixture());

    // Then
    expect(outcome).toEqual({ status: "sent", providerMessageId: null });
    const mail = transport.assertSent({
      to: EMAIL_MESSAGE_FIXTURE_RECIPIENT,
      subject: "인증 코드",
    });
    expect(mail.html).toBe(`<p>${EMAIL_MESSAGE_FIXTURE_CODE}</p>`);
    expect(mail.text).toBe(EMAIL_MESSAGE_FIXTURE_CODE);
    expect(transport.mails).toHaveLength(1);
  });

  it.each<[string, MailError, EmailDeliveryOutcome]>([
    [
      "일 한도 초과",
      new MailProviderError({
        provider: "resend",
        status: 429,
        providerCode: "daily_quota_exceeded",
      }),
      { status: "failed", reason: "quota_exhausted", retryable: false, scope: "daily" },
    ],
    [
      "월 한도 초과",
      new MailProviderError({
        provider: "resend",
        status: 429,
        providerCode: "monthly_quota_exceeded",
      }),
      { status: "failed", reason: "quota_exhausted", retryable: false, scope: "monthly" },
    ],
    [
      "이름 없는 429",
      new MailProviderError({ provider: "postmark", status: 429 }),
      { status: "failed", reason: "rate_limited", retryable: true },
    ],
    [
      "5xx",
      new MailProviderError({ provider: "resend", status: 503 }),
      { status: "failed", reason: "unavailable", retryable: true },
    ],
    [
      "같은 멱등 키의 동시 요청(409)",
      new MailProviderError({
        provider: "resend",
        status: 409,
        providerCode: "concurrent_idempotent_requests",
        permanent: false,
      }),
      { status: "failed", reason: "unavailable", retryable: true },
    ],
    [
      "검증 거절(4xx)",
      new MailProviderError({ provider: "resend", status: 422, providerCode: "validation_error" }),
      { status: "failed", reason: "rejected", retryable: false },
    ],
    [
      "연결 실패",
      new MailConnectionError("connect failed", { permanent: false }),
      { status: "failed", reason: "unavailable", retryable: true },
    ],
    [
      "잘못된 메시지",
      new MailMessageError("to", "is invalid"),
      { status: "failed", reason: "rejected", retryable: false },
    ],
  ])("%s 오류는 공급자 중립 결과로 옮긴다", async (_case, error, expected) => {
    // Given
    transport.failNext(error);

    // When
    const outcome = await sender.send(createEmailMessageFixture());

    // Then
    expect(outcome).toEqual(expected);
    expect(transport.mails).toHaveLength(0);
  });
});
