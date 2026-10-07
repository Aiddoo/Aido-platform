import { createRequire } from "node:module";

import { Logger } from "@nestjs/common";
import { TestBed } from "@suites/unit";
import { vi } from "vitest";

import { TypedConfigService } from "#api/platform/config/services/config.service";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { RetryablePushProviderTransportError } from "../../../application/ports/delivery/push-provider.port.js";
import { EXPO_PUSH_PAYLOAD_MAX_BYTE_LENGTH } from "./expo-push-message.js";
import { ExpoPushProvider } from "./expo-push.provider.js";

vi.hoisted(() => {
  process.env.EXPO_BASE_URL = "https://exp.host";
});

// Resolve the installed SDK's own transport; no extra dependency or SDK module mock.
interface FixtureAgent {
  disableNetConnect(): void;
  assertNoPendingInterceptors(): void;
  close(): Promise<void>;
  get(origin: string): {
    intercept(options: { path: string; method: string }): {
      reply(
        statusCode: number,
        data: unknown,
        options: { headers: Record<string, string> },
      ): unknown;
    };
  };
}
const require = createRequire(import.meta.url);
const transport: {
  MockAgent: new () => FixtureAgent;
  getGlobalDispatcher(): unknown;
  setGlobalDispatcher(dispatcher: unknown): void;
} = createRequire(require.resolve("expo-server-sdk"))("undici");

const token = "ExponentPushToken[notification14-synthetic-token]";
const credential = "notification14-synthetic-credential-not-real";
const body = "notification14-synthetic-private-body";
const privateMessage = `${credential}; token=${token}; body=${body}`;
const payload = () => ({ token, title: "fixture notification", body });
const sendPath = "/--/api/v2/push/send";
let agent: FixtureAgent;
let originalDispatcher: unknown;
let provider: ExpoPushProvider;
let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;
let nativeFetch: ReturnType<typeof vi.spyOn>;

function reply(path: string, statusCode: number, data: unknown) {
  return agent
    .get("https://exp.host")
    .intercept({ path, method: "POST" })
    .reply(statusCode, data, { headers: { "content-type": "application/json" } });
}
function expectPrivateLogsAbsent() {
  const logs = JSON.stringify([...warn.mock.calls, ...error.mock.calls]);
  for (const value of [credential, token, body]) expect(logs).not.toContain(value);
}

beforeEach(async () => {
  originalDispatcher = transport.getGlobalDispatcher();
  agent = new transport.MockAgent();
  agent.disableNetConnect();
  transport.setGlobalDispatcher(agent);
  warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  nativeFetch = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("External fetch blocked by fixture"));
  const { unit } = await TestBed.solitary(ExpoPushProvider)
    .mock(TypedConfigService)
    .impl(() => ({ expoAccessToken: credential }))
    .compile();
  provider = unit;
});
afterEach(async () => {
  try {
    agent.assertNoPendingInterceptors();
    expect(nativeFetch).not.toHaveBeenCalled();
    expectPrivateLogsAbsent();
  } finally {
    transport.setGlobalDispatcher(originalDispatcher);
    await agent.close();
  }
});

describe("ExpoPushProvider — installed SDK with blocked external network", () => {
  it.each([
    token,
    "ExpoPushToken[notification14-synthetic-token]",
    "12345678-1234-1234-1234-123456789012",
  ])("supports the SDK token format %s", (value) => {
    expect(provider.validateToken(value)).toBe(true);
  });
  it("rejects an invalid token before transport", async () => {
    expect(provider.validateToken("invalid-token")).toBe(false);
    await expect(provider.send({ ...payload(), token: "invalid-token" })).rejects.toBeInstanceOf(
      ApplicationException,
    );
  });
  it("returns a successful real SDK ticket", async () => {
    reply(sendPath, 200, { data: [{ status: "ok", id: "ticket-success" }] });
    await expect(provider.send(payload())).resolves.toEqual({
      token,
      success: true,
      ticketId: "ticket-success",
    });
  });
  it("keeps ordered error results and invalid tokens while hiding the vendor message in logs", async () => {
    const secondToken = "ExpoPushToken[notification14-second-synthetic-token]";
    reply(sendPath, 200, {
      data: [
        { status: "ok", id: "accepted-fixture-ticket" },
        { status: "error", message: privateMessage, details: { error: "DeviceNotRegistered" } },
      ],
    });
    const result = await provider.sendBatch([payload(), { ...payload(), token: secondToken }]);
    expect(result).toMatchObject({
      total: 2,
      successCount: 1,
      failureCount: 1,
      invalidTokens: [secondToken],
    });
    expect(result.results).toEqual([
      { token, success: true, ticketId: "accepted-fixture-ticket" },
      {
        token: secondToken,
        success: false,
        errorCode: "DeviceNotRegistered",
        error: privateMessage,
      },
    ]);
    expect(warn).toHaveBeenCalledWith({
      event: "notification.push_ticket_failed",
      provider: "expo",
      errorCode: "DeviceNotRegistered",
    });
  });
  it("does not treat an untrusted vendor error code as a safe log field", async () => {
    reply(sendPath, 200, {
      data: [{ status: "error", message: privateMessage, details: { error: privateMessage } }],
    });
    await expect(provider.send(payload())).resolves.toMatchObject({
      success: false,
      error: privateMessage,
      errorCode: privateMessage,
    });
    expect(warn).toHaveBeenCalledWith({
      event: "notification.push_ticket_failed",
      provider: "expo",
      errorCode: "UNKNOWN",
    });
  });
  it("preserves HTTP400 error details without logging the SDK message", async () => {
    reply(sendPath, 400, { errors: [{ code: "INVALID_REQUEST", message: privateMessage }] });
    await expect(provider.send(payload())).rejects.toMatchObject({
      errorCode: "NOTIFICATION_1003",
      details: { reason: privateMessage },
    });
    expect(error).toHaveBeenCalledWith({
      event: "notification.push_transport_failed",
      provider: "expo",
      mode: "single",
      statusCode: 400,
    });
  });
  it("preserves the accepted100/unconfirmed1 boundary when the second real SDK chunk fails", async () => {
    reply(sendPath, 200, {
      data: Array.from({ length: 100 }, (_, index) => ({ status: "ok", id: `accepted-${index}` })),
    });
    reply(sendPath, 500, { errors: [{ code: "SERVER_ERROR", message: privateMessage }] });
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
        mode: "batch",
        statusCode: 500,
        acceptedTicketCountBeforeFailure: 100,
      }),
    );
  });
  it("lets the SDK reject a ticket-count mismatch as a typed transport failure", async () => {
    reply(sendPath, 200, { data: [{ status: "ok", id: "only-one-ticket" }] });
    let failure: unknown;
    try {
      await provider.sendBatch([payload(), payload()]);
    } catch (caught) {
      failure = caught;
    }
    expect(failure).toBeInstanceOf(RetryablePushProviderTransportError);
    expect(failure).toMatchObject({
      metadata: {
        resolvedPayloadCountBeforeFailure: 0,
        acceptedTicketCountBeforeFailure: 0,
        unconfirmedPayloadCount: 2,
        unattemptedPayloadCount: 0,
      },
      cause: { message: "Expected Expo to respond with 2 tickets but got 1" },
    });
  });
  it("skips missing receipts and preserves returned DeviceNotRegistered details", async () => {
    reply("/--/api/v2/push/getReceipts", 200, {
      data: {
        fresh: {
          status: "error",
          message: privateMessage,
          details: { error: "DeviceNotRegistered" },
        },
      },
    });
    await expect(provider.getReceipts(["expired-missing", "fresh"])).resolves.toEqual([
      {
        ticketId: "fresh",
        delivered: false,
        errorCode: "DeviceNotRegistered",
        error: privateMessage,
      },
    ]);
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
  it("filters invalid and oversized payloads locally without losing result order", async () => {
    reply(sendPath, 200, { data: [{ status: "ok", id: "accepted-last" }] });
    const result = await provider.sendBatch([
      { ...payload(), token: "invalid-token" },
      { ...payload(), body: "x".repeat(EXPO_PUSH_PAYLOAD_MAX_BYTE_LENGTH) },
      payload(),
    ]);
    expect(result).toMatchObject({
      total: 3,
      successCount: 1,
      failureCount: 2,
      invalidTokens: ["invalid-token"],
    });
    expect(result.results.map((entry) => entry.errorCode ?? entry.ticketId)).toEqual([
      "NOTIFICATION_1001",
      "MessageTooBig",
      "accepted-last",
    ]);
  });
  it("returns an empty batch without transport", async () => {
    await expect(provider.sendBatch([])).resolves.toEqual({
      total: 0,
      successCount: 0,
      failureCount: 0,
      results: [],
      invalidTokens: [],
    });
  });
});
