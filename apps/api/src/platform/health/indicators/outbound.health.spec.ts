import { Logger } from "@nestjs/common";
import { HealthIndicatorService } from "@nestjs/terminus";

import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { RecordingOperationalAlert } from "#test/mocks/recording-operational-alert";

import { OutboundHealthIndicator } from "./outbound.health.js";

describe("OutboundHealthIndicator", () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("회로가 열린 정책이 있어도 up을 유지하고 공개 응답에는 degraded만 싣는다", async () => {
    // Given
    const registry = new OutboundPolicyRegistry(new RecordingOperationalAlert());
    const vendor = registry.get({
      name: "vendor",
      breakers: [
        { name: "health", consecutiveFailures: 1, halfOpenAfterMs: 60_000, handles: () => true },
      ],
    });
    registry.get({ name: "other" });
    await vendor.execute(() => Promise.reject(new Error("down"))).catch(() => null);
    const indicator = new OutboundHealthIndicator(new HealthIndicatorService(), registry);
    // When
    const result = indicator.isHealthy("outbound");
    // Then
    expect(result).toEqual({ outbound: { status: "up", degraded: true } });
    expect(JSON.stringify(result)).not.toContain("vendor");
  });
});
