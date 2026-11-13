import { Logger } from "@nestjs/common";

import {
  type AiAssistanceGenerationConfig,
  aiAssistanceGenerationConfig,
} from "#api/modules/ai-assistance/generation/ai-assistance-generation.config";
import { AiSpendBudgetAdapter } from "#api/modules/ai-assistance/generation/infrastructure/adapters/ai-spend-budget.adapter";
import { user as userTable } from "#api/platform/database/schema/index";
import { UsageMeterPort, USAGE_SUBJECT_ALL } from "#api/platform/metering/usage-meter.port";
import { createEntityId } from "#api/shared/domain/model/entity-id";
import { DateClock } from "#test/doubles/platform/date-clock";
import { UserFixture } from "#test/fixtures/index";
import { RecordingOperationalAlert } from "#test/mocks/recording-operational-alert";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../e2e/helpers/e2e-app-factory.js";

const NOW = new Date("2026-11-05T03:00:00.000Z");

describe("AI 비용 예산 누적 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let meter: UsageMeterPort;
  let config: AiAssistanceGenerationConfig;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 12 }) });
    client = await database.start();
    context = await createE2eApp({ testDatabase: database });
    meter = context.module.get(UsageMeterPort);
    config = context.module.get<AiAssistanceGenerationConfig>(aiAssistanceGenerationConfig.KEY);
  });
  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    if (context) {
      await destroyE2eApp(context);
    } else {
      await database?.stop();
    }
  });

  it("동시에 끝난 요청의 비용을 전역 일·월·사용자 일 행에 빠짐없이 더하고 경보는 한 번만 올린다", async () => {
    // Given
    const alert = new RecordingOperationalAlert();
    const budget = new AiSpendBudgetAdapter(config, meter, alert, new DateClock());
    // When
    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        budget.record(index % 2 === 0 ? "user-a" : "user-b", 60_000),
      ),
    );
    // Then
    expect(
      await meter.read([
        { meter: "ai.spend", periodKey: "2026-11-05", subject: USAGE_SUBJECT_ALL },
        { meter: "ai.spend", periodKey: "2026-11", subject: USAGE_SUBJECT_ALL },
        { meter: "ai.spend", periodKey: "2026-11-05", subject: "user-a" },
        { meter: "ai.spend", periodKey: "2026-11-05", subject: "user-b" },
      ]),
    ).toEqual([1_200_000, 1_200_000, 600_000, 600_000]);
    expect(alert.alerts).toEqual([
      expect.objectContaining({
        key: "ai.spend.threshold-reached",
        tags: { tier: "alert", window: "daily" },
      }),
    ]);
  });

  it("재시작한 서버도 저장된 사용량으로 예산을 판단한다", async () => {
    // Given
    await new AiSpendBudgetAdapter(
      config,
      meter,
      new RecordingOperationalAlert(),
      new DateClock(),
    ).record("user-a", 250_000);
    const restarted = new AiSpendBudgetAdapter(
      config,
      meter,
      new RecordingOperationalAlert(),
      new DateClock(),
    );
    // When
    const limited = await restarted.decide({ taskClass: "interactive", userId: "user-a" });
    const other = await restarted.decide({ taskClass: "interactive", userId: "user-b" });
    // Then
    expect(limited).toEqual({ type: "user-limited" });
    expect(other).toEqual({ type: "allowed" });
  });

  it("다음 UTC 날짜가 되면 일 예산을 새로 센다", async () => {
    // Given
    const budget = new AiSpendBudgetAdapter(
      config,
      meter,
      new RecordingOperationalAlert(),
      new DateClock(),
    );
    await budget.record("user-a", 250_000);
    // When
    vi.setSystemTime(new Date("2026-11-06T00:00:01.000Z"));
    const decision = await budget.decide({ taskClass: "interactive", userId: "user-a" });
    // Then
    expect(decision).toEqual({ type: "allowed" });
  });

  it.each(["ADMIN", "USER"] as const)(
    "저장된 역할 %s 도 같은 사용자 일 예산에서 막힌다(ADMIN 면제 없음)",
    async (role) => {
      // Given
      const user = UserFixture.create({
        id: createEntityId(),
        email: `spend-${role.toLowerCase()}@example.com`,
        userTag: `SPEND${role.slice(0, 3)}`,
        role,
        subscriptionStatus: "FREE",
      });
      await client.insert(userTable).values(user);
      const budget = context.module.get(AiSpendBudgetAdapter);
      await budget.record(user.id, 250_000);
      // When
      const result = await budget.decide({ taskClass: "interactive", userId: user.id });
      // Then
      expect(result).toEqual({ type: "user-limited" });
    },
  );
});
