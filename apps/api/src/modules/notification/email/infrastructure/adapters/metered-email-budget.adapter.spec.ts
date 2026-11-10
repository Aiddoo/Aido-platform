import {
  USAGE_SUBJECT_ALL,
  type UsageKey,
  type UsageMeterPort,
} from "#api/platform/metering/interfaces/usage-meter.interface";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import { InMemoryUsageMeterAdapter } from "#test/mocks/in-memory-usage-meter.adapter";

import { EMAIL_SENT_METER, MeteredEmailBudgetAdapter } from "./metered-email-budget.adapter.js";

const DAY: UsageKey = {
  meter: EMAIL_SENT_METER,
  periodKey: "2026-11-05",
  subject: USAGE_SUBJECT_ALL,
};
const MONTH: UsageKey = { ...DAY, periodKey: "2026-11" };

class RecordingLogger {
  readonly warnings: unknown[] = [];
  warn(entry: unknown): void {
    this.warnings.push(entry);
  }
}

describe("MeteredEmailBudgetAdapter", () => {
  let meter: InMemoryUsageMeterAdapter;
  let alert: RecordingOperationalAlert;
  let logger: RecordingLogger;
  let budget: MeteredEmailBudgetAdapter;
  let clock: FixedClock;

  function create(usage: Pick<UsageMeterPort, "tryReserve" | "release" | "read" | "add"> = meter) {
    return new MeteredEmailBudgetAdapter({ meter: usage, alert, logger, clock });
  }

  beforeEach(() => {
    clock = new FixedClock(Temporal.Instant.from("2026-11-05T03:00:00Z"));
    meter = new InMemoryUsageMeterAdapter();
    alert = new RecordingOperationalAlert();
    logger = new RecordingLogger();
    budget = create();
  });

  async function reserveMany(priority: "critical" | "standard", count: number) {
    const results: string[] = [];
    for (let index = 0; index < count; index += 1) {
      results.push(await budget.reserve(priority));
    }
    return results;
  }

  it("standard는 하루 70통에서 멈추고 critical은 그 뒤에도 100통까지 받는다", async () => {
    // Given
    const standard = await reserveMany("standard", 71);

    // When
    const critical = await reserveMany("critical", 31);

    // Then
    expect(standard.filter((result) => result === "reserved")).toHaveLength(70);
    expect(standard[70]).toBe("exhausted");
    expect(critical.filter((result) => result === "reserved")).toHaveLength(30);
    expect(critical[30]).toBe("exhausted");
    expect(await meter.read([DAY, MONTH])).toEqual([100, 100]);
  });

  it("월 예산에서 막히면 이미 예약한 일 건수를 되돌린다", async () => {
    // Given
    await meter.add([{ key: MONTH, amount: 2700 }]);

    // When
    const result = await budget.reserve("standard");

    // Then
    expect(result).toBe("exhausted");
    expect(await meter.read([DAY, MONTH])).toEqual([0, 2700]);
  });

  it("일 80통에 처음 닿을 때 한 번만 경보를 올린다", async () => {
    // When
    await reserveMany("critical", 85);

    // Then
    expect(alert.alerts).toEqual([
      expect.objectContaining({
        key: "notification.email.daily-budget-near",
        severity: "warning",
        details: { period: "2026-11-05", total: 80, threshold: 80 },
      }),
    ]);
  });

  it("예산을 다 써서 막힌 메일이 이어져도 그 날 경보는 한 번만 올린다", async () => {
    // Given
    await reserveMany("standard", 70);
    alert.alerts.length = 0;

    // When
    await reserveMany("standard", 5);

    // Then
    expect(alert.alerts).toEqual([
      expect.objectContaining({
        key: "notification.email.budget-exhausted",
        tags: { scope: "daily" },
      }),
    ]);
  });

  it("돌려주면 일·월 예약이 함께 줄어든다", async () => {
    // Given
    await reserveMany("critical", 3);

    // When
    await budget.release();

    // Then
    expect(await meter.read([DAY, MONTH])).toEqual([2, 2]);
  });

  it("공급자가 일 한도를 넘었다고 하면 일 계량을 100까지 채우고 경보를 올린다", async () => {
    // Given
    await reserveMany("critical", 10);
    alert.alerts.length = 0;

    // When
    await budget.settleProviderQuotaExhausted("daily");

    // Then
    expect(await meter.read([DAY, MONTH])).toEqual([100, 10]);
    expect(alert.alerts).toEqual([
      expect.objectContaining({
        key: "notification.email.provider-quota-exhausted",
        tags: { scope: "daily" },
      }),
    ]);
    expect(await budget.reserve("critical")).toBe("exhausted");
  });

  it("공급자가 월 한도를 넘었다고 하면 월 계량을 3000까지 채운다", async () => {
    // When
    await budget.settleProviderQuotaExhausted("monthly");

    // Then
    expect(await meter.read([MONTH])).toEqual([3000]);
  });

  it("계량기가 실패해도 인증 메일을 막지 않고 로그만 남긴다", async () => {
    // Given
    const broken = create({
      tryReserve: () => Promise.reject(new Error("database down")),
      release: () => Promise.reject(new Error("database down")),
      read: () => Promise.reject(new Error("database down")),
      add: () => Promise.reject(new Error("database down")),
    });

    // When
    const reservation = await broken.reserve("critical");
    await broken.release();

    // Then
    expect(reservation).toBe("reserved");
    expect(logger.warnings).toHaveLength(2);
  });
});
