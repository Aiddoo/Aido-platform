import { Logger } from "@nestjs/common";
import { vi } from "vitest";

import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";

import { RetryablePushProviderTransportError } from "../../application/ports/push-provider.port.js";
import { EXPO_PUSH_PAYLOAD_MAX_BYTE_LENGTH } from "./expo-push-message.mapper.js";
import {
  EXPO_RATE_EXCEEDED_RETRY_DELAYS_MS,
  ExpoPushSenderAdapter,
} from "./expo-push-sender.adapter.js";

vi.hoisted(() => {
  process.env.EXPO_BASE_URL = "https://exp.host";
});

const token = "ExponentPushToken[notification14-synthetic-token]";
const credential = "notification14-synthetic-credential-not-real";
const body = "notification14-synthetic-private-body";
const privateMessage = `${credential}; token=${token}; body=${body}`;
const payload = () => ({
  token,
  title: "fixture notification",
  body,
  priority: "high" as const,
  ttlSeconds: 3600,
});
const sendPath = "/--/api/v2/push/send";
let provider: ExpoPushSenderAdapter;
let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;
let nativeFetch: ReturnType<typeof vi.spyOn>;
let expectedReplies: Array<{ path: string; response: Response }>;

// expo-server-sdk 8 sends through the global fetch, so the fixture answers it in order.
function reply(path: string, statusCode: number, data: unknown) {
  expectedReplies.push({
    path,
    response: new Response(JSON.stringify(data), {
      status: statusCode,
      headers: { "content-type": "application/json" },
    }),
  });
}
function expectPrivateLogsAbsent() {
  const logs = JSON.stringify([...warn.mock.calls, ...error.mock.calls]);
  for (const value of [credential, token, body]) {
    expect(logs).not.toContain(value);
  }
}

beforeEach(() => {
  expectedReplies = [];
  warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  nativeFetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const expected = expectedReplies.shift();
    if (!expected) {
      throw new Error("External fetch blocked by fixture");
    }
    expect(new URL(String(input)).pathname).toBe(expected.path);
    return expected.response;
  });
  provider = new ExpoPushSenderAdapter(
    { expoAccessToken: credential },
    new OutboundPolicyRegistry(new RecordingOperationalAlert()),
  );
});
afterEach(() => {
  try {
    expect(expectedReplies).toHaveLength(0);
    expectPrivateLogsAbsent();
  } finally {
    nativeFetch.mockRestore();
  }
});

describe("ExpoPushSenderAdapter — 설치된 SDK와 차단된 외부 네트워크", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    token,
    "ExpoPushToken[notification14-synthetic-token]",
    "12345678-1234-1234-1234-123456789012",
  ])("SDK 토큰 형식 %s을 받아들인다", (value) => {
    // Given / When / Then
    expect(provider.validateToken(value)).toBe(true);
    expect(provider.validateToken("invalid-token")).toBe(false);
  });

  it("ticket 결과를 입력 순서대로 공급자 중립 실패 분류로 바꾸고 원문은 로그에 남기지 않는다", async () => {
    // Given
    const secondToken = "ExpoPushToken[notification14-second-synthetic-token]";
    reply(sendPath, 200, {
      data: [
        { status: "ok", id: "accepted-fixture-ticket" },
        { status: "error", message: privateMessage, details: { error: "DeviceNotRegistered" } },
      ],
    });

    // When
    const results = await provider.sendBatch([payload(), { ...payload(), token: secondToken }]);

    // Then
    expect(results).toEqual([
      { token, status: "accepted", ticketId: "accepted-fixture-ticket" },
      {
        token: secondToken,
        status: "rejected",
        failure: {
          kind: "DEVICE_UNREGISTERED",
          providerCode: "DeviceNotRegistered",
          message: privateMessage,
        },
      },
    ]);
    expect(warn).toHaveBeenCalledWith({
      event: "notification.push_ticket_failed",
      provider: "expo",
      failureKind: "DEVICE_UNREGISTERED",
    });
  });

  it("알 수 없는 공급자 코드는 UNKNOWN으로 분류한다", async () => {
    // Given
    reply(sendPath, 200, {
      data: [{ status: "error", message: privateMessage, details: { error: privateMessage } }],
    });

    // When
    const [result] = await provider.sendBatch([payload()]);

    // Then
    expect(result).toMatchObject({ status: "rejected", failure: { kind: "UNKNOWN" } });
  });

  it("기기별 MessageRateExceeded는 그 메시지만 backoff 뒤 다시 보낸다", async () => {
    // Given
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const secondToken = "ExpoPushToken[notification14-rate-limited-token]";
    reply(sendPath, 200, {
      data: [
        { status: "ok", id: "first-accepted" },
        { status: "error", message: "rate", details: { error: "MessageRateExceeded" } },
      ],
    });
    reply(sendPath, 200, { data: [{ status: "ok", id: "retried-accepted" }] });

    // When
    const pending = provider.sendBatch([payload(), { ...payload(), token: secondToken }]);
    await vi.runAllTimersAsync();

    // Then
    await expect(pending).resolves.toEqual([
      { token, status: "accepted", ticketId: "first-accepted" },
      { token: secondToken, status: "accepted", ticketId: "retried-accepted" },
    ]);
  });

  it("backoff를 다 써도 한도에 걸리면 토큰을 끄지 않는 RATE_LIMITED로 돌려준다", async () => {
    // Given
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const limited = { status: "error", message: "rate", details: { error: "MessageRateExceeded" } };
    for (let attempt = 0; attempt <= EXPO_RATE_EXCEEDED_RETRY_DELAYS_MS.length; attempt++) {
      reply(sendPath, 200, { data: [limited] });
    }

    // When
    const pending = provider.sendBatch([payload()]);
    await vi.runAllTimersAsync();

    // Then
    await expect(pending).resolves.toEqual([
      {
        token,
        status: "rejected",
        failure: { kind: "RATE_LIMITED", providerCode: "MessageRateExceeded", message: "rate" },
      },
    ]);
  });

  it("두 번째 청크 transport 실패는 수락 100건·미확인 1건 경계를 보존한 재시도 오류다", async () => {
    // Given
    reply(sendPath, 200, {
      data: Array.from({ length: 100 }, (_, index) => ({ status: "ok", id: `accepted-${index}` })),
    });
    reply(sendPath, 500, { errors: [{ code: "SERVER_ERROR", message: privateMessage }] });

    // When / Then
    await expect(provider.sendBatch(Array.from({ length: 101 }, payload))).rejects.toMatchObject({
      metadata: {
        providerName: "expo",
        resolvedPayloadCountBeforeFailure: 100,
        acceptedTicketCountBeforeFailure: 100,
        unconfirmedPayloadCount: 1,
        unattemptedPayloadCount: 0,
      },
      cause: { message: privateMessage, statusCode: 500 },
    });
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "notification.push_transport_failed",
        statusCode: 500,
        acceptedTicketCountBeforeFailure: 100,
      }),
    );
  });

  it("Expo가 30초 안에 응답하지 않으면 기다리기를 멈추고 미확인 재시도 오류로 넘긴다", async () => {
    // Given
    vi.useFakeTimers();
    nativeFetch.mockImplementationOnce(() => new Promise<Response>(() => {}));
    const sending = provider.sendBatch([payload()]).catch((cause: unknown) => cause);
    // When
    await vi.advanceTimersByTimeAsync(30_000);
    const failure = await sending;
    // Then
    expect(failure).toBeInstanceOf(RetryablePushProviderTransportError);
    expect(failure).toMatchObject({
      metadata: { providerName: "expo", unconfirmedPayloadCount: 1 },
      cause: { name: "OutboundTimeoutError", policy: "expo", timeoutMs: 30_000 },
    });
  });

  it("ticket 수가 맞지 않으면 SDK 오류를 재시도 가능한 transport 오류로 감싼다", async () => {
    // Given
    reply(sendPath, 200, { data: [{ status: "ok", id: "only-one-ticket" }] });

    // When
    const failure = await provider.sendBatch([payload(), payload()]).catch((caught) => caught);

    // Then
    expect(failure).toBeInstanceOf(RetryablePushProviderTransportError);
    expect(failure).toMatchObject({
      metadata: { resolvedPayloadCountBeforeFailure: 0, unconfirmedPayloadCount: 2 },
    });
  });

  it("아직 결과가 없는 receipt는 빼고 실패 receipt는 공급자 중립 분류로 돌려준다", async () => {
    // Given
    reply("/--/api/v2/push/getReceipts", 200, {
      data: {
        fresh: {
          status: "error",
          message: privateMessage,
          details: { error: "DeviceNotRegistered" },
        },
        delivered: { status: "ok" },
      },
    });

    // When / Then
    await expect(provider.getReceipts(["missing", "fresh", "delivered"])).resolves.toEqual([
      {
        ticketId: "fresh",
        status: "failed",
        failure: {
          kind: "DEVICE_UNREGISTERED",
          providerCode: "DeviceNotRegistered",
          message: privateMessage,
        },
      },
      { ticketId: "delivered", status: "delivered" },
    ]);
  });

  it("형식이 틀린 토큰과 큰 payload는 보내지 않고 순서를 지켜 실패로 돌려준다", async () => {
    // Given
    reply(sendPath, 200, { data: [{ status: "ok", id: "accepted-last" }] });

    // When
    const results = await provider.sendBatch([
      { ...payload(), token: "invalid-token" },
      { ...payload(), body: "x".repeat(EXPO_PUSH_PAYLOAD_MAX_BYTE_LENGTH) },
      payload(),
    ]);

    // Then
    expect(
      results.map((result) =>
        result.status === "accepted" ? result.ticketId : result.failure.kind,
      ),
    ).toEqual(["INVALID_TOKEN", "PAYLOAD_TOO_LARGE", "accepted-last"]);
  });

  it("빈 배치는 공급자를 부르지 않는다", async () => {
    // Given / When / Then
    await expect(provider.sendBatch([])).resolves.toEqual([]);
  });
});
