import type {
  UsageKey,
  UsageMeterPort,
  UsageReservation,
} from "#api/platform/metering/usage-meter.port";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import { suppressLogger } from "#test/setup/suppress-logger";

import { WEATHERKIT_MONTHLY_CALL_LIMIT } from "./weather-outbound.policy.js";
import { WeatherKitUsageMeterAdapter } from "./weatherkit-usage-meter.adapter.js";

/** 월별 누적을 기억하고 한도를 넘는 예약은 거절한다. 받은 예약 수를 센다. */
class CountingUsageMeter implements Pick<UsageMeterPort, "tryReserve"> {
  readonly totals = new Map<string, number>();
  reservationCount = 0;

  async tryReserve(key: UsageKey, amount: number, limit: number): Promise<UsageReservation> {
    this.reservationCount += 1;
    const current = this.totals.get(key.periodKey) ?? 0;
    if (current + amount > limit) {
      return { isAccepted: false, total: current };
    }
    this.totals.set(key.periodKey, current + amount);
    return { isAccepted: true, total: current + amount };
  }
}

describe("WeatherKitUsageMeterAdapter — 월 호출 예산", () => {
  beforeEach(() => {
    suppressLogger();
  });

  it("한도에 닿은 달에는 DB에 다시 예약하지 않고 거절하며, 달이 바뀌면 다시 예약한다", async () => {
    // Given
    const meter = new CountingUsageMeter();
    const clock = new FixedClock(Temporal.Instant.from("2026-11-30T12:00:00Z"));
    const adapter = new WeatherKitUsageMeterAdapter(meter, new RecordingOperationalAlert(), clock);
    meter.totals.set("2026-11", WEATHERKIT_MONTHLY_CALL_LIMIT);
    await adapter.reserveCall();
    // When
    const sameMonth = await adapter.reserveCall();
    clock.advanceBy({ hours: 24 });
    const nextMonth = await adapter.reserveCall();
    // Then
    expect(sameMonth).toBe(false);
    expect(nextMonth).toBe(true);
    expect(meter.reservationCount).toBe(2);
    expect(adapter.currentState()).toBe("normal");
  });
});
