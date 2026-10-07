import { ErrorCode } from "@aido/api/errors";
import sql from "sql-template-tag";

import {
  ENTITLEMENT_READER,
  type EntitlementReaderPort,
  Feature,
} from "#api/modules/access/access-entitlement.public";
import {
  AI_QUOTA,
  type AiQuotaPort,
} from "#api/modules/access/application/ports/quotas/ai-quota.port";
import {
  AI_QUOTA_REPOSITORY,
  type AiQuotaRepositoryPort,
} from "#api/modules/access/application/ports/quotas/ai-quota.repository.port";
import { encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { sqlStatement } from "#api/platform/database/database-sql";
import { createEntityId } from "#api/platform/database/database-values";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { UserFixture } from "#test/fixtures/index";
import { createTestClient, withDatabaseTransaction } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../e2e/helpers/e2e-app-factory.js";

const newMonthAt = new Date("2026-09-30T15:00:01.000Z");
const oldMonthAt = new Date("2026-09-30T14:59:59.000Z");

describe("AI quota 한도·기간·트랜잭션 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let quota: AiQuotaPort;
  let unitOfWork: UnitOfWorkPort;
  let entitlement: EntitlementReaderPort;
  let repository: AiQuotaRepositoryPort;
  let userId: string;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 6 }) });
    client = await database.start();
    context = await createE2eApp({ testDatabase: database });
    quota = context.module.get(AI_QUOTA);
    unitOfWork = context.module.get(UNIT_OF_WORK);
    entitlement = context.module.get(ENTITLEMENT_READER);
    repository = context.module.get(AI_QUOTA_REPOSITORY);
  });
  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(newMonthAt);
    const user = UserFixture.create({
      id: createEntityId(),
      email: "access-quota@example.com",
      userTag: "QUOTBF01",
      aiUsageCount: 4,
      aiUsageResetAt: newMonthAt,
      subscriptionStatus: "FREE",
      createdAt: newMonthAt,
      updatedAt: newMonthAt,
    });
    await client.orm.public.User.create(encodeCreate("User", user));
    userId = user.id;
  });
  afterEach(() => vi.useRealTimers());
  afterAll(async () => {
    if (context) await destroyE2eApp(context);
    else await database?.stop();
  });

  async function contend() {
    const acquired = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    const holding = withDatabaseTransaction(client, async (transaction) => {
      await transaction.query(
        sqlStatement(
          transaction,
          sql`SELECT "id" FROM "User" WHERE "id"=${userId} FOR NO KEY UPDATE`,
        )
          .returnsRow({ id: "pg/text@1" })
          .build(),
      );
      acquired.resolve();
      await released.promise;
    });
    await Promise.race([
      acquired.promise,
      holding.then(() => {
        throw new Error("User row lock released before contenders");
      }),
    ]);
    const outcomes = Promise.allSettled([quota.reserve(userId), quota.reserve(userId)]);
    let observedWaiters = 0;
    try {
      await vi.waitFor(
        async () => {
          const waiting = await client.runtime().query(
            client.raw.sql`
          SELECT count(*)::int AS count FROM pg_stat_activity
          WHERE datname=current_database() AND wait_event_type='Lock'
            AND query LIKE '%User%FOR NO KEY UPDATE%'
        `
              .returnsRow({ count: "pg/int4@1" })
              .build(),
          );
          observedWaiters = waiting[0]?.count ?? 0;
          expect(observedWaiters).toBe(2);
        },
        { timeout: 5000, interval: 10 },
      );
    } finally {
      released.resolve();
      await holding;
      await outcomes;
    }
    return { outcomes: await outcomes, observedWaiters };
  }

  it("무료 한도 직전의 동시 두 요청은 하나만 소비해야 한다", async () => {
    // Given
    expect(await repository.findQuotaState(userId)).toMatchObject({
      count: 4,
      resetAt: newMonthAt,
    });
    // When
    const { outcomes, observedWaiters } = await contend();
    const usage = await repository.findQuotaState(userId);
    const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled").length;
    // Then
    expect(observedWaiters).toBe(2);
    expect(fulfilled).toBe(1);
    expect(outcomes.find((outcome) => outcome.status === "rejected")).toMatchObject({
      reason: { errorCode: ErrorCode.AI_1303, details: { used: 5, limit: 5 } },
    });
    expect(usage?.count).toBe(5);
  });

  it("새 달의 동시 두 요청은 각각 소비되어 사용량 2를 저장해야 한다", async () => {
    // Given
    await client.orm.public.User.where({ id: userId }).update(
      encodePatch("User", { aiUsageCount: 5, aiUsageResetAt: oldMonthAt }),
    );
    // When
    const { outcomes, observedWaiters } = await contend();
    const usage = await repository.findQuotaState(userId);
    const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled").length;
    // Then
    expect(observedWaiters).toBe(2);
    expect(fulfilled).toBe(2);
    expect(usage?.count).toBe(2);
  });

  it("이전 달 요청의 실패 보상은 새 달에 성공한 사용량을 감소시키지 않아야 한다", async () => {
    // Given
    vi.setSystemTime(oldMonthAt);
    await client.orm.public.User.where({ id: userId }).update(
      encodePatch("User", { aiUsageCount: 0, aiUsageResetAt: oldMonthAt }),
    );
    const oldReservation = await quota.reserve(userId);
    const oldReserved = await repository.findQuotaState(userId);
    vi.setSystemTime(newMonthAt);
    await quota.reserve(userId);
    const newReserved = await repository.findQuotaState(userId);
    // When
    await quota.release(oldReservation);
    const usage = await repository.findQuotaState(userId);
    // Then
    expect(oldReserved?.count).toBe(1);
    expect(newReserved?.count).toBe(1);
    expect(usage?.count).toBe(1);
    expect(usage?.resetAt).toEqual(newMonthAt);
  });

  it.each([
    { name: "ADMIN", role: "ADMIN", subscriptionStatus: "FREE" },
    { name: "ACTIVE", role: "USER", subscriptionStatus: "ACTIVE" },
  ] satisfies Array<{
    name: string;
    role: "USER" | "ADMIN";
    subscriptionStatus: "FREE" | "ACTIVE";
  }>)(
    "캐시에 남은 $name 무제한 권한보다 잠금 안의 최신 무료 한도를 적용한다",
    async ({ role, subscriptionStatus }) => {
      // Given
      await client.orm.public.User.where({ id: userId }).updateAndCount(
        encodePatch("User", { role, subscriptionStatus, aiUsageCount: 5 }),
      );
      expect((await entitlement.getFeatureLimit(userId, Feature.AI_PARSE)).dailyLimit).toBeNull();
      await client.orm.public.User.where({ id: userId }).updateAndCount(
        encodePatch("User", { role: "USER", subscriptionStatus: "FREE" }),
      );
      // When / Then
      await expect(quota.reserve(userId)).rejects.toMatchObject({
        errorCode: ErrorCode.AI_1303,
        details: { used: 5, limit: 5 },
      });
      expect((await repository.findQuotaState(userId))?.count).toBe(5);
    },
  );

  it("새 달의 사용량 조회는 0과 KST 다음 리셋을 반환하고 저장된 카운터는 변경하지 않는다", async () => {
    // Given
    await client.orm.public.User.where({ id: userId }).updateAndCount(
      encodePatch("User", { aiUsageCount: 5, aiUsageResetAt: oldMonthAt }),
    );
    // When
    const usage = await quota.read(userId);
    // Then
    expect(usage).toEqual({ used: 0, limit: 5, resetsAt: "2026-10-31T15:00:00.000Z" });
    expect(await repository.findQuotaState(userId)).toMatchObject({
      count: 5,
      resetAt: oldMonthAt,
    });
  });

  it("상위 트랜잭션이 실패하면 quota 예약의 카운터 증가도 rollback한다", async () => {
    // Given
    const failure = new Error("업무 트랜잭션 실패");
    // When
    await expect(
      unitOfWork.run(async () => {
        await quota.reserve(userId);
        expect((await repository.findQuotaState(userId))?.count).toBe(5);
        throw failure;
      }),
    ).rejects.toBe(failure);
    // Then
    expect((await repository.findQuotaState(userId))?.count).toBe(4);
  });

  it("한 사용자의 잠금 대기는 다른 사용자의 quota 예약을 막지 않는다", async () => {
    // Given
    const other = UserFixture.create({
      id: createEntityId(),
      email: "other-quota@example.com",
      userTag: "QUOTOT01",
      aiUsageCount: 0,
      aiUsageResetAt: newMonthAt,
      subscriptionStatus: "FREE",
    });
    await client.orm.public.User.create(encodeCreate("User", other));
    const acquired = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    const holding = withDatabaseTransaction(client, async (transaction) => {
      await transaction.query(
        sqlStatement(
          transaction,
          sql`SELECT "id" FROM "User" WHERE "id"=${userId} FOR NO KEY UPDATE`,
        )
          .returnsRow({ id: "pg/text@1" })
          .build(),
      );
      acquired.resolve();
      await released.promise;
    });
    await Promise.race([
      acquired.promise,
      holding.then(() => {
        throw new Error("사용자 잠금이 먼저 해제되었습니다.");
      }),
    ]);
    const blocked = Promise.allSettled([quota.reserve(userId)]);
    let completed = false;
    const independent = quota.reserve(other.id).then(() => {
      completed = true;
    });
    // When
    try {
      await vi.waitFor(
        async () => {
          const waiting = await client.runtime().query(
            client.raw.sql`
          SELECT count(*)::int AS count FROM pg_stat_activity
          WHERE datname=current_database() AND wait_event_type='Lock'
            AND query LIKE '%User%FOR NO KEY UPDATE%'
        `
              .returnsRow({ count: "pg/int4@1" })
              .build(),
          );
          expect(waiting[0]?.count).toBe(1);
          expect(completed).toBe(true);
        },
        { timeout: 5000 },
      );
      expect((await repository.findQuotaState(other.id))?.count).toBe(1);
    } finally {
      released.resolve();
      await holding;
      await blocked;
      await independent;
    }
    // Then
    expect((await blocked)[0]?.status).toBe("fulfilled");
    expect((await repository.findQuotaState(userId))?.count).toBe(5);
  });

  it("저장소의 보상 UPDATE는 현재 resetAt과 양수 카운터가 일치할 때만 적용한다", async () => {
    // Given
    await client.orm.public.User.where({ id: userId }).updateAndCount(
      encodePatch("User", { aiUsageCount: 2 }),
    );
    // When / Then
    expect(await repository.releaseUsage(userId, { count: 1, expectedResetAt: oldMonthAt })).toBe(
      false,
    );
    expect((await repository.findQuotaState(userId))?.count).toBe(2);
    expect(await repository.releaseUsage(userId, { count: 1, expectedResetAt: newMonthAt })).toBe(
      true,
    );
    await client.orm.public.User.where({ id: userId }).updateAndCount(
      encodePatch("User", { aiUsageCount: 0 }),
    );
    expect(await repository.releaseUsage(userId, { count: -1, expectedResetAt: newMonthAt })).toBe(
      false,
    );
    expect((await repository.findQuotaState(userId))?.count).toBe(0);
  });

  it("삭제된 사용자의 quota 예약은 기존 USER_0601과 userId details를 반환한다", async () => {
    // Given
    await client.orm.public.User.where({ id: userId }).deleteAndCount();
    // When / Then
    await expect(quota.reserve(userId)).rejects.toMatchObject({
      errorCode: ErrorCode.USER_0601,
      details: { userId },
    });
  });
});
