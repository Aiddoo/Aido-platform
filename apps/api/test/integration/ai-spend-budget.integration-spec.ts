import { Logger } from "@nestjs/common";

import {
  ENTITLEMENT_READER,
  type EntitlementReaderPort,
} from "#api/modules/access/access-entitlement.public";
import { AiSpendBudget } from "#api/modules/ai-assistance/infrastructure/adapters/generation/ai-spend.budget";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { createEntityId } from "#api/platform/database/entity-id";
import { user as userTable } from "#api/platform/database/schema/index";
import {
  USAGE_METER,
  USAGE_SUBJECT_ALL,
  type UsageMeterPort,
} from "#api/platform/metering/interfaces/usage-meter.interface";
import { UserFixture } from "#test/fixtures/index";
import { stubAccessTiers } from "#test/mocks/ai-provider-http.stub";
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
  let access: EntitlementReaderPort;
  let context: E2eTestContext;
  let meter: UsageMeterPort;
  let config: TypedConfigService;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 12 }) });
    client = await database.start();
    context = await createE2eApp({ testDatabase: database });
    meter = context.module.get(USAGE_METER);
    config = context.module.get(TypedConfigService);
    access = context.module.get(ENTITLEMENT_READER);
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
    const guard = new AiSpendBudget(config, meter, alert, stubAccessTiers());
    // When
    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        guard.record(index % 2 === 0 ? "user-a" : "user-b", 60_000),
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
    await new AiSpendBudget(
      config,
      meter,
      new RecordingOperationalAlert(),
      stubAccessTiers(),
    ).record("user-a", 250_000);
    const restarted = new AiSpendBudget(
      config,
      meter,
      new RecordingOperationalAlert(),
      stubAccessTiers(),
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
    const guard = new AiSpendBudget(
      config,
      meter,
      new RecordingOperationalAlert(),
      stubAccessTiers(),
    );
    await guard.record("user-a", 250_000);
    // When
    vi.setSystemTime(new Date("2026-11-06T00:00:01.000Z"));
    const decision = await guard.decide({ taskClass: "interactive", userId: "user-a" });
    // Then
    expect(decision).toEqual({ type: "allowed" });
  });

  it.each([
    { role: "ADMIN", decision: { type: "allowed" } },
    { role: "USER", decision: { type: "user-limited" } },
  ] as const)(
    "저장된 역할 $role 의 사용자 일 예산 판단은 access 정책을 따른다",
    async ({ role, decision }) => {
      // Given
      const user = UserFixture.create({
        id: createEntityId(),
        email: `spend-${role.toLowerCase()}@example.com`,
        userTag: `SPEND${role.slice(0, 3)}`,
        role,
        subscriptionStatus: "FREE",
      });
      await client.insert(userTable).values(user);
      const guard = new AiSpendBudget(config, meter, new RecordingOperationalAlert(), access);
      await guard.record(user.id, 250_000);
      // When
      const result = await guard.decide({ taskClass: "interactive", userId: user.id });
      // Then
      expect(result).toEqual(decision);
    },
  );
});
