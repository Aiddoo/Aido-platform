import { Logger } from "@nestjs/common";

import { defineAlerts } from "#api/shared/application/alerts/define-alerts";
import { RecordingOperationalAlert } from "#test/mocks/recording-operational-alert";

import { OutboundRejectedError, OutboundTimeoutError } from "./outbound-policy.errors.js";
import type { OutboundPolicySpec } from "./outbound-policy.js";
import { isTransportFailure } from "./outbound-policy.js";
import { OutboundPolicyRegistry } from "./outbound-policy.registry.js";

const START = new Date("2026-11-05T00:00:00.000Z");

class VendorDown extends Error {}

const VendorAlerts = defineAlerts("vendor", {
  BILLING_CIRCUIT_OPENED: {
    key: "vendor.billing",
    severity: "error",
    summary: "결제 실패",
    runbook: "결제 수단을 확인한다",
  },
});

const HEALTH: OutboundPolicySpec = {
  name: "vendor",
  breakers: [
    {
      name: "health",
      consecutiveFailures: 3,
      halfOpenAfterMs: 60_000,
      handles: (error) => error instanceof VendorDown || isTransportFailure(error),
      handlesResult: (result) => result === 503,
    },
  ],
  describeFailure: (failure): Readonly<Record<string, string>> =>
    failure === 503 ? { statusCode: "503" } : {},
};

function createPolicy(spec: OutboundPolicySpec = HEALTH) {
  const alert = new RecordingOperationalAlert();
  const registry = new OutboundPolicyRegistry(alert);
  return { policy: registry.get(spec), registry, alert };
}

const fail = () => Promise.reject(new VendorDown());

describe("OutboundPolicy — 회로·bulkhead·시도별 timeout", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let log: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
    warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("연속 실패가 기준에 닿으면 회로를 한 번 열고 차단 시간 동안 호출하지 않고 거절한다", async () => {
    // Given
    const { policy } = createPolicy();
    const call = vi.fn(fail);
    for (let index = 0; index < 3; index += 1) {
      await policy.execute(call).catch(() => null);
    }
    // When
    const rejected = await policy.execute(call).catch((error: unknown) => error);
    // Then
    expect(rejected).toBeInstanceOf(OutboundRejectedError);
    expect(rejected).toMatchObject({ policy: "vendor", reason: "circuit-open" });
    expect(call).toHaveBeenCalledTimes(3);
    expect(policy.isOpen()).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith({
      event: "outbound.circuit.opened",
      policy: "vendor",
      breaker: "health",
      cooldownMs: 60_000,
    });
  });

  it("기준 전에 성공하면 연속 실패 수를 다시 센다", async () => {
    // Given
    const { policy } = createPolicy();
    // When
    await policy.execute(fail).catch(() => null);
    await policy.execute(fail).catch(() => null);
    await policy.execute(async () => "ok");
    await policy.execute(fail).catch(() => null);
    await policy.execute(fail).catch(() => null);
    // Then
    expect(policy.isOpen()).toBe(false);
  });

  it("차단 시간이 지나면 isOpen이 false가 되고 시험 호출이 성공하면 회로를 닫는다", async () => {
    // Given
    const { policy } = createPolicy();
    for (let index = 0; index < 3; index += 1) {
      await policy.execute(fail).catch(() => null);
    }
    // When
    vi.setSystemTime(START.getTime() + 60_000);
    const beforeTrial = policy.isOpen();
    const result = await policy.execute(async () => "ok");
    // Then
    expect([beforeTrial, result, policy.isOpen()]).toEqual([false, "ok", false]);
    expect(log).toHaveBeenCalledWith({
      event: "outbound.circuit.half-open",
      policy: "vendor",
      breaker: "health",
    });
    expect(log).toHaveBeenCalledWith({
      event: "outbound.circuit.closed",
      policy: "vendor",
      breaker: "health",
    });
  });

  it("시험 호출에서 세지 않는 오류가 나도 회로를 닫지 않고 다시 연다", async () => {
    // Given
    const { policy } = createPolicy();
    for (let index = 0; index < 3; index += 1) {
      await policy.execute(fail).catch(() => null);
    }
    vi.setSystemTime(START.getTime() + 60_000);
    // When
    const trial = policy.execute(async () => {
      throw new Error("요청 오류");
    });
    // Then
    await expect(trial).rejects.toThrow("요청 오류");
    expect(policy.isOpen()).toBe(true);
  });

  it("시험 호출이 실패하면 다시 열고 차단 시간을 새로 센다", async () => {
    // Given
    const { policy } = createPolicy();
    for (let index = 0; index < 3; index += 1) {
      await policy.execute(fail).catch(() => null);
    }
    vi.setSystemTime(START.getTime() + 60_000);
    // When
    await policy.execute(fail).catch(() => null);
    vi.setSystemTime(START.getTime() + 119_000);
    // Then
    expect(policy.isOpen()).toBe(true);
    expect(policy.getState().openBreakers).toEqual(["health"]);
  });

  it("던지지 않고 돌아온 실패 결과(5xx)도 회로가 세고 결과는 그대로 돌려준다", async () => {
    // Given
    const { policy } = createPolicy();
    // When
    const results = [];
    for (let index = 0; index < 3; index += 1) {
      results.push(await policy.execute(async () => 503));
    }
    // Then
    expect(results).toEqual([503, 503, 503]);
    expect(policy.isOpen()).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ statusCode: "503" }));
  });

  it("회로가 세지 않는 오류(요청 오류 등)는 그대로 던지고 회로를 열지 않는다", async () => {
    // Given
    const { policy } = createPolicy();
    // When
    for (let index = 0; index < 5; index += 1) {
      await policy.execute(() => Promise.reject(new TypeError("bad request"))).catch(() => null);
    }
    // Then
    expect(policy.isOpen()).toBe(false);
  });

  it("경보를 단 회로는 열릴 때만 운영 경보를 한 번 올린다", async () => {
    // Given
    const { policy, alert } = createPolicy({
      name: "billing-vendor",
      breakers: [
        {
          name: "billing",
          consecutiveFailures: 1,
          halfOpenAfterMs: 900_000,
          handles: (error) => error instanceof VendorDown,
          alert: VendorAlerts.BILLING_CIRCUIT_OPENED,
        },
      ],
    });
    // When
    await policy.execute(fail).catch(() => null);
    await policy.execute(fail).catch(() => null);
    // Then
    expect(alert.alerts).toEqual([
      {
        ...VendorAlerts.BILLING_CIRCUIT_OPENED,
        tags: { policy: "billing-vendor", breaker: "billing" },
        details: { cooldownMs: 900_000 },
      },
    ]);
  });

  it("같은 이름은 같은 정책을 돌려줘 회로를 함께 쓴다", () => {
    // Given
    const { registry, policy } = createPolicy();
    // When
    const again = registry.get({ name: "vendor" });
    // Then
    expect(again).toBe(policy);
    expect(Object.keys(registry.getStates())).toEqual(["vendor"]);
  });

  it("동시 호출과 대기열이 가득 차면 호출하지 않고 bulkhead-full로 거절한다", async () => {
    // Given
    const { policy } = createPolicy({ name: "narrow", bulkhead: { limit: 1, queue: 1 } });
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const running = policy.execute(() => gate);
    const queued = policy.execute(async () => "queued");
    // When
    const rejected = await policy.execute(async () => "never").catch((error: unknown) => error);
    release();
    // Then
    expect(rejected).toMatchObject({ policy: "narrow", reason: "bulkhead-full" });
    expect(warn).toHaveBeenCalledWith({ event: "outbound.bulkhead.rejected", policy: "narrow" });
    await running;
    expect(await queued).toBe("queued");
  });

  it("signal을 무시하는 호출도 시도별 제한 시간이 지나면 기다리지 않고 OutboundTimeoutError로 끝낸다", async () => {
    // Given
    vi.useRealTimers();
    const { policy } = createPolicy({ name: "slow-sdk", timeoutMs: 20 });
    // When
    const failure = await policy
      .execute(() => new Promise<string>(() => {}))
      .catch((error: unknown) => error);
    // Then
    expect(failure).toBeInstanceOf(OutboundTimeoutError);
    expect(failure).toMatchObject({ policy: "slow-sdk", timeoutMs: 20 });
  });

  it("시간 초과는 전송 실패로 세어 장애 회로를 연다", async () => {
    // Given
    vi.useRealTimers();
    const { policy } = createPolicy({ ...HEALTH, name: "slow-vendor", timeoutMs: 5 });
    // When
    for (let index = 0; index < 3; index += 1) {
      await policy.execute(() => new Promise(() => {})).catch(() => null);
    }
    // Then
    expect(policy.isOpen()).toBe(true);
  });

  it("시험 호출이 진행 중이면 다른 호출은 기다리지 않고 거절하고 결과가 나면 다시 받는다", async () => {
    // Given
    const { policy } = createPolicy();
    for (let index = 0; index < 3; index += 1) {
      await policy.execute(fail).catch(() => null);
    }
    vi.setSystemTime(START.getTime() + 60_000);
    const { promise: probeResult, resolve: finishProbe } = Promise.withResolvers<string>();
    const probe = policy.execute(() => probeResult);
    const waiter = vi.fn(async () => "waiter");
    // When
    const rejected = await policy.execute(waiter).catch((error: unknown) => error);
    const openDuringProbe = policy.isOpen();
    finishProbe("probe");
    await probe;
    const afterProbe = await policy.execute(waiter);
    // Then
    expect(rejected).toBeInstanceOf(OutboundRejectedError);
    expect(rejected).toMatchObject({ reason: "circuit-open" });
    expect(openDuringProbe).toBe(true);
    expect(afterProbe).toBe("waiter");
    expect(waiter).toHaveBeenCalledTimes(1);
  });
});
