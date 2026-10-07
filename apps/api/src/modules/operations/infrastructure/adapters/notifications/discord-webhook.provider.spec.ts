import { Logger } from "@nestjs/common";
import { HttpClient } from "@nestjs/http-client";

import { AdminNotificationInfraEvent } from "../../observability/notifications/admin-notification-infra.events.js";
import { DiscordWebhookProvider } from "./discord-webhook.provider.js";

const WEBHOOK = "https://discord.com/api/webhooks/synthetic-id/synthetic-private-token";
const PRIVATE_BODY = "synthetic-private-notification-body";
const SECRET = `${WEBHOOK};${PRIVATE_BODY}`;

function provider(webhook: string | undefined = WEBHOOK) {
  return new DiscordWebhookProvider(
    webhook,
    new HttpClient({ retry: { attempts: 3, methods: ["POST"] }, throwOnHttpError: true }),
  );
}

describe("DiscordWebhookProvider 실제 HTTP wire와 로그 경계", () => {
  let errorLog: ReturnType<typeof vi.spyOn>;
  let debugLog: ReturnType<typeof vi.spyOn>;
  let nativeFetch: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorLog = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    debugLog = vi.spyOn(Logger.prototype, "debug").mockImplementation(() => undefined);
    nativeFetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Live network blocked"));
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-08T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    const logs = JSON.stringify([...errorLog.mock.calls, ...debugLog.mock.calls]);
    expect(logs).not.toContain("synthetic-private-token");
    expect(logs).not.toContain(PRIVATE_BODY);
  });

  it("204 응답에서 기존 embed JSON·헤더·기본 color와 timestamp를 보낸다", async () => {
    // Given
    const fetch = nativeFetch.mockResolvedValue(new Response(null, { status: 204 }));
    const notification = { title: "관리자 알림", body: PRIVATE_BODY };

    // When
    const result = await provider().send(notification);

    // Then
    expect(result).toEqual({ success: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    const call = fetch.mock.calls[0];
    if (call === undefined) throw new Error("HTTP fixture request missing");
    const [url, init] = call;
    expect(String(url)).toBe(WEBHOOK);
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
    expect(init?.body).toBe(
      JSON.stringify({
        embeds: [
          {
            title: notification.title,
            description: PRIVATE_BODY,
            color: 0x5865f2,
            fields: [],
            timestamp: "2026-10-08T00:00:00.000Z",
          },
        ],
      }),
    );
    expect(errorLog).not.toHaveBeenCalled();
  });

  it("readonly fields와 지정 color를 같은 wire 값으로 보존한다", async () => {
    // Given
    const fetch = nativeFetch.mockResolvedValue(new Response(null, { status: 204 }));
    const fields: readonly {
      readonly name: string;
      readonly value: string;
      readonly inline: boolean;
    }[] = Object.freeze([Object.freeze({ name: "분류", value: "결제", inline: true })]);

    // When
    await provider().send({ title: "결제 알림", body: PRIVATE_BODY, color: 0x123456, fields });

    // Then
    expect(fetch.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({
        embeds: [
          {
            title: "결제 알림",
            description: PRIVATE_BODY,
            color: 0x123456,
            fields,
            timestamp: "2026-10-08T00:00:00.000Z",
          },
        ],
      }),
    );
  });

  it.each([400, 429])(
    "HTTP %i 원문은 caller에 반환하고 로그는 status만 남기며 재시도하지 않는다",
    async (status) => {
      // Given
      const fetch = nativeFetch.mockResolvedValue(new Response(SECRET, { status }));

      // When
      const result = await provider().send({ title: "실패 알림", body: PRIVATE_BODY });

      // Then
      expect(result).toEqual({ success: false, error: `HTTP ${status}: ${SECRET}` });
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(errorLog).toHaveBeenCalledExactlyOnceWith({
        event: AdminNotificationInfraEvent.HTTP_FAILED,
        provider: "discord",
        statusCode: status,
        errorType: "http",
      });
    },
  );

  it("실제 HttpClient transport 오류의 기존 결과는 유지하고 원문·오류 name·stack을 로그에서 제외한다", async () => {
    // Given
    const failure = new Error(SECRET);
    failure.name = SECRET;
    const fetch = nativeFetch.mockRejectedValue(failure);

    // When
    const result = await provider().send({ title: "transport 실패", body: PRIVATE_BODY });

    // Then
    expect(result.success).toBe(false);
    expect(result.error).toContain(WEBHOOK);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(errorLog).toHaveBeenCalledExactlyOnceWith({
      event: AdminNotificationInfraEvent.REQUEST_FAILED,
      provider: "discord",
      errorType: "transport",
    });
  });

  it.each([undefined, ""])(
    "미설정 URL %s는 HTTP 호출 없이 기존 실패 결과를 반환한다",
    async (webhook) => {
      // Given
      const fetch = nativeFetch;
      const instance = new DiscordWebhookProvider(webhook, new HttpClient());

      // When
      const result = await instance.send({ title: "skip", body: PRIVATE_BODY });

      // Then
      expect(result).toEqual({ success: false, error: "Webhook URL not configured" });
      expect(fetch).not.toHaveBeenCalled();
      expect(debugLog).toHaveBeenCalledExactlyOnceWith({
        event: AdminNotificationInfraEvent.PROVIDER_NOT_CONFIGURED,
        provider: "discord",
      });
    },
  );
});
