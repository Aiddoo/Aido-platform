import { ACCOUNT_DELETION } from "@aido/api";

import { PurgeDeletedAccountsUseCase } from "#api/modules/identity/users/application/use-cases/purge-deleted-accounts.use-case";
import { createEntityId } from "#api/platform/database/entity-id";
import { user as userTable } from "#api/platform/database/schema/index";
import { DrizzleUsageMeterAdapter } from "#api/platform/metering/adapters/drizzle-usage-meter.adapter";
import { describeUsageMeterContract } from "#api/platform/metering/adapters/usage-meter.contract";
import {
  USAGE_METER,
  USAGE_SUBJECT_ALL,
  type UsageMeterPort,
} from "#api/platform/metering/interfaces/usage-meter.interface";
import { subtractDays } from "#api/shared/domain/date/utils/arithmetic";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { UserFixture } from "#test/fixtures/index";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../e2e/helpers/e2e-app-factory.js";

const KEY = { meter: "email.sent", periodKey: "2026-11-05", subject: USAGE_SUBJECT_ALL };

describe("OutboundUsage 계량기 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let meter: UsageMeterPort;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 12 }) });
    client = await database.start();
    context = await createE2eApp({ testDatabase: database });
    meter = context.module.get(USAGE_METER);
  });
  afterAll(async () => {
    if (context) {
      await destroyE2eApp(context);
    } else {
      await database?.stop();
    }
  });

  describeUsageMeterContract({
    createMeter: () => meter,
    cleanup: () => context.reset(),
  });

  it("계정을 영구 삭제하면 사용자 일 비용 행을 지우고 전역 행은 남긴다", async () => {
    // Given
    const user = UserFixture.create({
      id: createEntityId(),
      email: "usage-purge@example.com",
      userTag: "USGPURGE",
      status: "SUSPENDED",
      deletedAt: instantFromDate(subtractDays(ACCOUNT_DELETION.GRACE_PERIOD_DAYS + 1)),
    });
    await client.insert(userTable).values(user);
    const userKey = { meter: "ai.spend", periodKey: "2026-11-05", subject: user.id };
    const globalKey = { ...userKey, subject: USAGE_SUBJECT_ALL };
    await meter.add([
      { key: userKey, amount: 100 },
      { key: globalKey, amount: 100 },
    ]);
    // When
    await context.module.get(PurgeDeletedAccountsUseCase, { strict: false }).execute();
    // Then
    expect(await meter.read([userKey, globalKey])).toEqual([0, 100]);
    await context.reset();
  });

  it("운영 모듈은 Postgres 어댑터를 쓴다", () => {
    // Then
    expect(meter).toBeInstanceOf(DrizzleUsageMeterAdapter);
  });

  it("한도 10에 50건이 동시에 예약해도 정확히 10건만 받는다", async () => {
    // When
    const results = await Promise.all(
      Array.from({ length: 50 }, () => meter.tryReserve(KEY, 1, 10)),
    );

    // Then
    expect(results.filter((result) => result.isAccepted)).toHaveLength(10);
    expect(await meter.read([KEY])).toEqual([10]);
    await context.reset();
  });

  it("동시에 더해도 누적값은 모두 다르고 마지막 값이 합계다", async () => {
    // When
    const totals = await Promise.all(
      Array.from({ length: 20 }, () => meter.add([{ key: KEY, amount: 3 }])),
    );

    // Then
    const seen = totals.map(([total]) => total);
    expect(new Set(seen).size).toBe(20);
    expect(Math.max(...seen.map((total) => total ?? 0))).toBe(60);
    await context.reset();
  });
});
