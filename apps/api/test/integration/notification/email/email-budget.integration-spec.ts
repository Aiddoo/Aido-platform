import { MeteredEmailBudgetAdapter } from "#api/modules/notification/email/infrastructure/adapters/metered-email-budget.adapter";
import { UsageMeterPort, USAGE_SUBJECT_ALL } from "#api/platform/metering/usage-meter.port";
import { usagePeriod } from "#api/platform/metering/usage-period";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "#test/e2e/helpers/e2e-app-factory";
import { RecordingOperationalAlert } from "#test/mocks/recording-operational-alert";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase } from "#test/setup/test-database";

describe("이메일 발송 예산 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let context: E2eTestContext;
  let meter: UsageMeterPort;
  let alerts: RecordingOperationalAlert;
  let budget: MeteredEmailBudgetAdapter;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 12 }) });
    await database.start();
    context = await createE2eApp({ testDatabase: database });
    meter = context.module.get(UsageMeterPort);
  });

  afterAll(async () => {
    if (context) {
      await destroyE2eApp(context);
    } else {
      await database?.stop();
    }
  });

  beforeEach(async () => {
    await context.reset();
    alerts = new RecordingOperationalAlert();
    budget = new MeteredEmailBudgetAdapter({
      meter,
      alert: alerts,
      clock: context.module.get(ClockPort),
      logger: { warn: () => undefined },
    });
  });

  const dayKey = () => ({
    meter: "email.sent",
    periodKey: usagePeriod.day(new Date()),
    subject: USAGE_SUBJECT_ALL,
  });

  it("standard 150건이 동시에 예약해도 정확히 70건만 받고 일 계량은 70이다", async () => {
    // When
    const results = await Promise.all(
      Array.from({ length: 150 }, () => budget.reserve("standard")),
    );

    // Then
    expect(results.filter((result) => result === "reserved")).toHaveLength(70);
    expect(await meter.read([dayKey()])).toEqual([70]);
  });

  it("standard가 70에서 멈춘 뒤에도 critical은 동시에 몰려도 정확히 30건 더 받는다", async () => {
    // Given
    await Promise.all(Array.from({ length: 70 }, () => budget.reserve("standard")));

    // When
    const results = await Promise.all(Array.from({ length: 60 }, () => budget.reserve("critical")));

    // Then
    expect(results.filter((result) => result === "reserved")).toHaveLength(30);
    expect(await meter.read([dayKey()])).toEqual([100]);
  });

  it("동시에 몰려도 일 80통 경보는 한 번만 올라간다", async () => {
    // When
    await Promise.all(Array.from({ length: 100 }, () => budget.reserve("critical")));

    // Then
    expect(
      alerts.alerts.filter((alert) => alert.key === "notification.email.daily-budget-near"),
    ).toHaveLength(1);
    expect(
      alerts.alerts.filter((alert) => alert.key === "notification.email.budget-exhausted"),
    ).toHaveLength(0);
  });

  it("한도에 막힌 요청이 동시에 이어져도 소진 경보는 그 날 한 번만 올라간다", async () => {
    // Given
    await Promise.all(Array.from({ length: 70 }, () => budget.reserve("standard")));

    // When
    await Promise.all(Array.from({ length: 20 }, () => budget.reserve("standard")));

    // Then
    expect(
      alerts.alerts.filter((alert) => alert.key === "notification.email.budget-exhausted"),
    ).toHaveLength(1);
  });

  it("공급자가 일 한도 초과를 알려 오면 계량이 100으로 맞춰져 critical도 막힌다", async () => {
    // Given
    await Promise.all(Array.from({ length: 12 }, () => budget.reserve("critical")));

    // When
    await budget.settleProviderQuotaExhausted("daily");

    // Then
    expect(await meter.read([dayKey()])).toEqual([100]);
    expect(await budget.reserve("critical")).toBe("exhausted");
  });
});
