import { Logger } from "@nestjs/common";
import { HttpClient } from "@nestjs/http-client";

import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { RecordingOperationalAlert } from "#test/mocks/recording-operational-alert";

import {
  type AdminNotifierContractScenario,
  CONTRACT_NOTICE,
  describeAdminNotifierContract,
} from "../../../../../../test/contracts/operations/admin-notifier.contract.js";
import { AdminNoticeInfraLogEvent } from "../admin-notices-infra.log-events.js";
import {
  DISCORD_WEBHOOK_TIMEOUT_MS,
  DiscordAdminNotifierAdapter,
} from "./discord-admin-notifier.adapter.js";

const ADMIN_WEBHOOK = "https://discord.com/api/webhooks/synthetic-id/synthetic-admin-token";
const PAYMENT_WEBHOOK = "https://discord.com/api/webhooks/synthetic-id/synthetic-payment-token";
const PRIVATE_BODY = "synthetic-private-notification-body";

function adapter(
  webhooks: { admin?: string; payment?: string } = {
    admin: ADMIN_WEBHOOK,
    payment: PAYMENT_WEBHOOK,
  },
) {
  return new DiscordAdminNotifierAdapter(
    { admin: webhooks.admin, payment: webhooks.payment },
    new HttpClient({ retry: { attempts: 3, methods: ["POST"] }, throwOnHttpError: true }),
    new OutboundPolicyRegistry(new RecordingOperationalAlert()),
  );
}

describe("DiscordAdminNotifierAdapter 실제 HTTP wire와 로그 경계", () => {
  let errorLog: ReturnType<typeof vi.spyOn>;
  let debugLog: ReturnType<typeof vi.spyOn>;
  let nativeFetch: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorLog = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    debugLog = vi.spyOn(Logger.prototype, "debug").mockImplementation(() => undefined);
    nativeFetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Live network blocked"));
    vi.useFakeTimers({ toFake: ["Date", "Temporal"] });
    vi.setSystemTime(new Date("2026-10-08T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    const logs = JSON.stringify([...errorLog.mock.calls, ...debugLog.mock.calls]);
    expect(logs).not.toContain("synthetic-admin-token");
    expect(logs).not.toContain("synthetic-payment-token");
    expect(logs).not.toContain(PRIVATE_BODY);
  });

  describeAdminNotifierContract({
    scenarios: [
      "sent",
      "not-configured",
      "server-error",
      "rate-limited",
      "rejected",
      "unreachable",
    ],
    arrange: (scenario: AdminNotifierContractScenario) => {
      switch (scenario) {
        case "sent":
          nativeFetch.mockResolvedValue(new Response(null, { status: 204 }));
          return adapter();
        case "not-configured":
          return adapter({});
        case "server-error":
          nativeFetch.mockResolvedValue(new Response(PRIVATE_BODY, { status: 500 }));
          return adapter();
        case "rate-limited":
          nativeFetch.mockResolvedValue(new Response(PRIVATE_BODY, { status: 429 }));
          return adapter();
        case "rejected":
          nativeFetch.mockResolvedValue(new Response(PRIVATE_BODY, { status: 404 }));
          return adapter();
        case "unreachable":
          nativeFetch.mockRejectedValue(new Error(`${ADMIN_WEBHOOK};${PRIVATE_BODY}`));
          return adapter();
      }
    },
  });

  it("채널의 webhook으로 embed JSON·헤더·severity 색·시각 타임스탬프·링크를 보낸다", async () => {
    // Given
    const fetch = nativeFetch.mockResolvedValue(new Response(null, { status: 204 }));

    // When
    await adapter().send("payment", CONTRACT_NOTICE);

    // Then
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(String(url)).toBe(PAYMENT_WEBHOOK);
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
    expect(init?.body).toBe(
      JSON.stringify({
        embeds: [
          {
            title: "contract-private-title",
            description: "contract-private-body",
            color: 0xf1c40f,
            fields: [
              { name: "텍스트", value: "contract-private-field", inline: true },
              { name: "시각", value: "<t:1793836800:f>" },
            ],
            url: "https://example.com/contract-private-link",
            timestamp: "2026-10-08T00:00:00.000Z",
          },
        ],
      }),
    );
  });

  it("admin 채널은 admin webhook으로 보낸다", async () => {
    // Given
    const fetch = nativeFetch.mockResolvedValue(new Response(null, { status: 204 }));

    // When
    await adapter().send("admin", {
      type: "message",
      message: { title: "가입", body: PRIVATE_BODY, severity: "success" },
    });

    // Then
    expect(String(fetch.mock.calls[0]?.[0])).toBe(ADMIN_WEBHOOK);
  });

  it("HTTP 실패는 재시도 없이 한 번만 보내고 로그에는 상태 코드만 남긴다", async () => {
    // Given
    const fetch = nativeFetch.mockResolvedValue(new Response(PRIVATE_BODY, { status: 429 }));

    // When
    await adapter().send("admin", CONTRACT_NOTICE);

    // Then
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(errorLog).toHaveBeenCalledExactlyOnceWith({
      event: AdminNoticeInfraLogEvent.HTTP_FAILED,
      provider: "discord",
      channel: "admin",
      statusCode: 429,
      errorType: "http",
    });
  });

  it("응답이 없는 webhook은 제한 시간 뒤 재시도 가능한 실패로 끊는다", async () => {
    // Given
    vi.useFakeTimers({ toFake: ["Date", "Temporal", "setTimeout", "clearTimeout"] });
    nativeFetch.mockImplementation(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );

    // When
    const pending = adapter().send("admin", CONTRACT_NOTICE);
    await vi.advanceTimersByTimeAsync(DISCORD_WEBHOOK_TIMEOUT_MS);
    const outcome = await pending;

    // Then
    expect(outcome).toEqual({ status: "failed", retryable: true });
    expect(errorLog).toHaveBeenCalledExactlyOnceWith({
      event: AdminNoticeInfraLogEvent.REQUEST_FAILED,
      provider: "discord",
      channel: "admin",
      errorType: "transport",
    });
  });

  it.each([undefined, ""])("미설정 URL %s는 HTTP 호출 없이 건너뛴다", async (webhook) => {
    // When
    const outcome = await adapter({ admin: webhook }).send("admin", CONTRACT_NOTICE);

    // Then
    expect(outcome).toEqual({ status: "skipped", reason: "not_configured" });
    expect(nativeFetch).not.toHaveBeenCalled();
    expect(debugLog).toHaveBeenCalledExactlyOnceWith({
      event: AdminNoticeInfraLogEvent.PROVIDER_NOT_CONFIGURED,
      provider: "discord",
      channel: "admin",
    });
  });
});
