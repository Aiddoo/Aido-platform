import { ErrorCode } from "@aido/api/errors";
import { PLAN_CATALOG } from "@aido/api/vocabulary";
import { and, eq, sql } from "drizzle-orm";

import { EntitlementReaderPort } from "#api/modules/access/entitlements/access-entitlements.public";
import {
  QuotaLedgerPort,
  type QuotaReserveInput,
} from "#api/modules/access/quotas/access-quotas.public";
import { QuotaUsageRepositoryPort } from "#api/modules/access/quotas/application/ports/quota-usage.repository.port";
import { RefundAbandonedQuotaReservationsUseCase } from "#api/modules/access/quotas/application/use-cases/refund-abandoned-quota-reservations.use-case";
import { QuotaWindow } from "#api/modules/access/quotas/domain/quota-window.vo";
import {
  QUOTA_REQUEST_HASH_RETENTION_MS,
  QUOTA_RESERVATION_TAKEOVER_AFTER_MS,
} from "#api/modules/access/quotas/domain/quotas.constants";
import { PremiumGranterPort } from "#api/modules/billing/subscriptions/billing-subscriptions.public";
import { isUniqueConstraintViolation } from "#api/platform/database/database-error.util";
import { createEntityId } from "#api/platform/database/entity-id";
import { quotaCharge, quotaUsage, user as userTable } from "#api/platform/database/schema/index";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate, instantToDate } from "#api/shared/domain/time/instant";
import { UserFixture } from "#test/fixtures/index";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../e2e/helpers/e2e-app-factory.js";

const FREE_AI_LIMIT = PLAN_CATALOG.AI_PARSE.free;

function periodKeyOf(at: Date): string {
  return QuotaWindow.monthOf(instantFromDate(at)).periodKey;
}
const FREE_VOICE_LIMIT = PLAN_CATALOG.VOICE_NOTE.free;

const newMonthAt = new Date("2026-09-30T15:00:01.000Z");
const oldMonthAt = new Date("2026-09-30T14:59:59.000Z");

describe("QuotaLedger 원장·카운터·멱등 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let ledger: QuotaLedgerPort;
  let refundAbandoned: RefundAbandonedQuotaReservationsUseCase;
  let usageRepository: QuotaUsageRepositoryPort;
  let unitOfWork: UnitOfWorkPort;
  let entitlement: EntitlementReaderPort;
  let userId: string;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 6 }) });
    client = await database.start();
    context = await createE2eApp({ testDatabase: database });
    ledger = context.module.get(QuotaLedgerPort);
    refundAbandoned = context.module.get(RefundAbandonedQuotaReservationsUseCase, {
      strict: false,
    });
    usageRepository = context.module.get(QuotaUsageRepositoryPort, { strict: false });
    unitOfWork = context.module.get(UNIT_OF_WORK);
    entitlement = context.module.get(EntitlementReaderPort);
  });
  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(newMonthAt);
    const user = UserFixture.create({
      id: createEntityId(),
      email: "quota-ledger@example.com",
      userTag: "QUOTLD01",
      aiUsageCount: FREE_AI_LIMIT - 1,
      aiUsageResetAt: instantFromDate(newMonthAt),
      subscriptionStatus: "FREE",
      createdAt: instantFromDate(newMonthAt),
      updatedAt: instantFromDate(newMonthAt),
    });
    await client.insert(userTable).values(user);
    userId = user.id;
  });
  afterEach(() => vi.useRealTimers());
  afterAll(async () => {
    if (context) {
      await destroyE2eApp(context);
    } else {
      await database?.stop();
    }
  });

  function input(overrides: Partial<QuotaReserveInput> = {}): QuotaReserveInput {
    return {
      userId: UserId.reconstitute(userId),
      feature: "AI_PARSE",
      idempotencyKey: null,
      reason: "parse-todo",
      ...overrides,
    };
  }

  async function storedAiUsage() {
    const [row] = await client
      .select({ count: userTable.aiUsageCount, resetAt: userTable.aiUsageResetAt })
      .from(userTable)
      .where(eq(userTable.id, userId));
    return row == null ? row : { ...row, resetAt: instantToDate(row.resetAt) };
  }

  async function storedVoiceUsage(periodKey = periodKeyOf(newMonthAt)) {
    const [row] = await client
      .select({ used: quotaUsage.used })
      .from(quotaUsage)
      .where(
        and(
          eq(quotaUsage.userId, userId),
          eq(quotaUsage.meter, "VOICE_NOTE"),
          eq(quotaUsage.periodKey, periodKey),
        ),
      );
    return row?.used ?? 0;
  }

  async function storedCharges() {
    return client.select().from(quotaCharge).where(eq(quotaCharge.userId, userId));
  }

  /** 사용자 행 잠금을 먼저 잡고 두 작업이 잠금 대기에 들어간 것을 확인한 뒤 풀어 실제 경쟁을 만든다. */
  async function contend<T>(work: () => Promise<T>) {
    const acquired = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    const holding = client.transaction(async (transaction) => {
      await transaction.execute(
        sql`SELECT "id" FROM "User" WHERE "id"=${userId} FOR NO KEY UPDATE`,
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
    const outcomes = Promise.allSettled([work(), work()]);
    let observedWaiters = 0;
    try {
      await vi.waitFor(
        async () => {
          const waiting = await client.execute<{ count: number }>(sql`
            SELECT count(*)::int AS count FROM pg_stat_activity
            WHERE datname=current_database() AND wait_event_type='Lock'
            AND query ILIKE '%User%FOR NO KEY UPDATE%'
          `);
          observedWaiters = waiting.rows[0]?.count ?? 0;
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

  describe("멈춘 예약 정리", () => {
    const stale = new Date(newMonthAt.getTime() + QUOTA_RESERVATION_TAKEOVER_AFTER_MS);

    it("이어받을 시간이 지난 RESERVED만 돌려주고 확정·최근 예약은 그대로 둔다", async () => {
      // Given
      await client.update(userTable).set({ aiUsageCount: 0 }).where(eq(userTable.id, userId));
      await ledger.reserve(input());
      const committed = await ledger.reserve(input());
      await ledger.commit(committed);
      vi.setSystemTime(stale.getTime() - 1);
      await ledger.reserve(input());
      vi.setSystemTime(stale);

      // When
      await refundAbandoned.execute();

      // Then
      expect((await storedAiUsage())?.count).toBe(2);
      expect((await storedCharges()).map((charge) => charge.status).toSorted()).toEqual([
        "COMMITTED",
        "REFUNDED",
        "RESERVED",
      ]);
    });

    it("정리 두 번이 잠금을 두고 경쟁해도 정확히 한 번만 돌려준다", async () => {
      // Given
      await ledger.reserve(input({ feature: "VOICE_NOTE" }));
      await ledger.reserve(input({ feature: "AI_PARSE" }));
      vi.setSystemTime(stale);

      // When
      const { outcomes, observedWaiters } = await contend(() => refundAbandoned.execute());

      // Then
      expect(observedWaiters).toBe(2);
      expect(outcomes.every((outcome) => outcome.status === "fulfilled")).toBe(true);
      expect((await storedAiUsage())?.count).toBe(FREE_AI_LIMIT - 1);
      expect(await storedVoiceUsage()).toBe(0);
      expect(await storedCharges()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ status: "REFUNDED", refundReason: "ABANDONED", attempt: 1 }),
        ]),
      );
    });

    it("7일 지난 차감의 요청 해시를 지우고 최근 차감은 둔다", async () => {
      // Given
      await ledger.commit(
        await ledger.reserve(
          input({ feature: "VOICE_NOTE", idempotencyKey: "old", requestHash: "old-hash" }),
        ),
      );
      await ledger.commit(
        await ledger.reserve(
          input({ feature: "VOICE_NOTE", idempotencyKey: "recent", requestHash: "recent-hash" }),
        ),
      );
      await client
        .update(quotaCharge)
        .set({
          createdAt: instantFromDate(newMonthAt).subtract({
            milliseconds: QUOTA_REQUEST_HASH_RETENTION_MS + 1,
          }),
        })
        .where(eq(quotaCharge.idempotencyKey, "old"));
      await client
        .update(quotaCharge)
        .set({ createdAt: instantFromDate(newMonthAt) })
        .where(eq(quotaCharge.idempotencyKey, "recent"));
      // When
      await refundAbandoned.execute();
      // Then
      const rows = await client.query.quotaCharge.findMany({ where: { userId } });
      expect(rows.find((row) => row.idempotencyKey === "old")?.requestHash).toBeNull();
      expect(rows.find((row) => row.idempotencyKey === "recent")?.requestHash).toBe("recent-hash");
    });

    it("RESERVED를 찾는 정리 쿼리는 전체를 훑지 않고 부분 인덱스를 쓴다", async () => {
      // Given
      const cutoff = stale.toISOString();
      await client.insert(quotaCharge).values(
        Array.from({ length: 2000 }, (_, index) => ({
          userId,
          meter: "VOICE_NOTE" as const,
          idempotencyKey: `settled-${index}`,
          amount: 1,
          attempt: 1,
          periodKey: "2026-M10",
          reason: "voice-note-digest",
          status: "COMMITTED" as const,
          updatedAt: instantFromDate(newMonthAt),
        })),
      );
      await client.execute(sql`ANALYZE "QuotaCharge"`);

      // When
      const plan = await client.execute<{ "QUERY PLAN": string }>(sql`
        EXPLAIN SELECT * FROM "QuotaCharge"
        WHERE "status" = 'RESERVED' AND "updatedAt" <= ${cutoff}
        ORDER BY "updatedAt" ASC LIMIT 100
      `);

      // Then
      expect(plan.rows.map((row) => row["QUERY PLAN"]).join("\n")).toContain(
        "QuotaCharge_reserved_updatedAt_idx",
      );
    });

    describe("quota-abandoned-refund.v1 잡과 이어받기가 겹칠 때", () => {
      const key = "stale-key";
      const reserveAgain = () =>
        ledger.reserve(input({ feature: "VOICE_NOTE", idempotencyKey: key }));
      const sweep = () => refundAbandoned.execute();

      /** 사용자 행 잠금을 쥔 채 작업을 차례로 대기열에 세운 뒤 풀어 PostgreSQL이 그 순서로 처리하게 한다. */
      async function queueInOrder<A, B>(first: () => Promise<A>, second: () => Promise<B>) {
        const acquired = Promise.withResolvers<void>();
        const released = Promise.withResolvers<void>();
        const holding = client.transaction(async (transaction) => {
          await transaction.execute(
            sql`SELECT "id" FROM "User" WHERE "id"=${userId} FOR NO KEY UPDATE`,
          );
          acquired.resolve();
          await released.promise;
        });
        await acquired.promise;
        const waitForWaiters = (count: number) =>
          vi.waitFor(
            async () => {
              const waiting = await client.execute<{ count: number }>(sql`
                SELECT count(*)::int AS count FROM pg_stat_activity
                WHERE datname=current_database() AND wait_event_type='Lock'
                AND query ILIKE '%User%FOR NO KEY UPDATE%'
              `);
              expect(waiting.rows[0]?.count).toBe(count);
            },
            { timeout: 5000, interval: 10 },
          );
        const firstOutcome = first();
        await waitForWaiters(1);
        const secondOutcome = second();
        await waitForWaiters(2);
        released.resolve();
        await holding;
        return { first: await firstOutcome, second: await secondOutcome };
      }

      it("잡이 먼저면 돌려준 뒤 다시 차감해 순 차감이 한 번이고 이전 시도의 확정은 무시된다", async () => {
        // Given
        const abandoned = await reserveAgain();
        vi.setSystemTime(stale);

        // When
        const { second: reservation } = await queueInOrder(sweep, reserveAgain);
        const lateCommit = await ledger.commit(abandoned);
        const committed = await ledger.commit(reservation);
        await sweep();

        // Then
        expect(reservation).toMatchObject({ isAlreadyCommitted: false, attempt: 2 });
        expect(lateCommit).toBe(false);
        expect(committed).toBe(true);
        expect(await storedCharges()).toEqual([
          expect.objectContaining({ status: "COMMITTED", attempt: 2, refundReason: null }),
        ]);
        expect(await storedVoiceUsage()).toBe(1);
      });

      it("이어받기가 먼저면 잡은 새 예약을 돌려주지 않고 순 차감이 한 번이다", async () => {
        // Given
        const abandoned = await reserveAgain();
        vi.setSystemTime(stale);

        // When
        const { first: reservation } = await queueInOrder(reserveAgain, sweep);
        const stored = await storedCharges();
        const lateCommit = await ledger.commit(abandoned);
        const committed = await ledger.commit(reservation);

        // Then
        expect(reservation).toMatchObject({ isAlreadyCommitted: false, attempt: 2 });
        expect(stored).toEqual([
          expect.objectContaining({ status: "RESERVED", attempt: 2, refundReason: null }),
        ]);
        expect(lateCommit).toBe(false);
        expect(committed).toBe(true);
        expect(await storedVoiceUsage()).toBe(1);
      });
    });

    it("정리한 뒤 늦게 온 확정은 무시되고 같은 키 재시도는 한 번만 다시 차감한다", async () => {
      // Given
      const key = "late-key";
      const first = await ledger.reserve(input({ feature: "VOICE_NOTE", idempotencyKey: key }));
      vi.setSystemTime(stale);
      await refundAbandoned.execute();

      // When
      const lateCommit = await ledger.commit(first);
      const retried = await ledger.reserve(input({ feature: "VOICE_NOTE", idempotencyKey: key }));

      // Then
      expect(lateCommit).toBe(false);
      expect(retried.attempt).toBe(2);
      expect(await storedVoiceUsage()).toBe(1);
    });
  });

  describe("동시 예약", () => {
    it("무료 AI 한도 직전의 동시 두 요청은 하나만 차감하고 다른 요청은 차감 없이 AI_1303이다", async () => {
      // When
      const { outcomes, observedWaiters } = await contend(() => ledger.reserve(input()));

      // Then
      expect(observedWaiters).toBe(2);
      expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
      expect(outcomes.find((outcome) => outcome.status === "rejected")).toMatchObject({
        reason: {
          errorCode: ErrorCode.AI_1303,
          details: {
            charged: false,
            featureQuota: { used: FREE_AI_LIMIT, limit: FREE_AI_LIMIT, remaining: 0 },
          },
        },
      });
      expect((await storedAiUsage())?.count).toBe(FREE_AI_LIMIT);
      expect(await storedCharges()).toHaveLength(1);
    });

    it("녹음 정리 마지막 1회에 겹친 두 요청은 QuotaUsage를 한도 넘게 올리지 않는다", async () => {
      // Given
      for (let index = 0; index < FREE_VOICE_LIMIT - 1; index += 1) {
        await ledger.reserve(input({ feature: "VOICE_NOTE" }));
      }

      // When
      const { outcomes } = await contend(() => ledger.reserve(input({ feature: "VOICE_NOTE" })));

      // Then
      expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
      expect(outcomes.find((outcome) => outcome.status === "rejected")).toMatchObject({
        reason: { errorCode: ErrorCode.AI_1313, details: { charged: false } },
      });
      expect(await storedVoiceUsage()).toBe(FREE_VOICE_LIMIT);
    });

    it("새 달의 동시 두 요청은 각각 차감되어 사용량 2를 저장한다", async () => {
      // Given
      await client
        .update(userTable)
        .set({ aiUsageCount: FREE_AI_LIMIT, aiUsageResetAt: instantFromDate(oldMonthAt) })
        .where(eq(userTable.id, userId));

      // When
      const { outcomes } = await contend(() => ledger.reserve(input()));

      // Then
      expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(2);
      expect((await storedAiUsage())?.count).toBe(2);
    });

    it("한 사용자의 잠금 대기는 다른 사용자의 예약을 막지 않는다", async () => {
      // Given
      const other = UserFixture.create({
        id: createEntityId(),
        email: "other-ledger@example.com",
        userTag: "QUOTLD02",
        aiUsageCount: 0,
        aiUsageResetAt: instantFromDate(newMonthAt),
        subscriptionStatus: "FREE",
      });
      await client.insert(userTable).values(other);
      const acquired = Promise.withResolvers<void>();
      const released = Promise.withResolvers<void>();
      const holding = client.transaction(async (transaction) => {
        await transaction.execute(
          sql`SELECT "id" FROM "User" WHERE "id"=${userId} FOR NO KEY UPDATE`,
        );
        acquired.resolve();
        await released.promise;
      });
      await acquired.promise;
      const blocked = Promise.allSettled([ledger.reserve(input())]);

      // When
      try {
        await vi.waitFor(
          async () => {
            const waiting = await client.execute<{ count: number }>(sql`
              SELECT count(*)::int AS count FROM pg_stat_activity
              WHERE datname=current_database() AND wait_event_type='Lock'
              AND query ILIKE '%User%FOR NO KEY UPDATE%'
            `);
            expect(waiting.rows[0]?.count).toBe(1);
          },
          { timeout: 5000, interval: 10 },
        );
        await ledger.reserve(input({ userId: UserId.reconstitute(other.id) }));
      } finally {
        released.resolve();
        await holding;
      }

      // Then
      expect((await blocked)[0]?.status).toBe("fulfilled");
      expect((await storedAiUsage())?.count).toBe(FREE_AI_LIMIT);
    });
  });

  describe("환불", () => {
    it("같은 예약을 동시에 두 번 환불해도 카운터는 한 번만 돌아온다", async () => {
      // Given
      const reservation = await ledger.reserve(input({ feature: "VOICE_NOTE" }));

      // When
      const results = await Promise.all([
        ledger.refund(reservation, "FAILED"),
        ledger.refund(reservation, "FAILED"),
      ]);

      // Then
      expect(results.toSorted()).toEqual([false, true]);
      expect(await storedVoiceUsage()).toBe(0);
      expect(await storedCharges()).toMatchObject([
        { status: "REFUNDED", refundReason: "FAILED", attempt: 1 },
      ]);
    });

    it("지난 달 예약의 환불은 새 달 사용량을 줄이지 않는다", async () => {
      // Given
      vi.setSystemTime(oldMonthAt);
      await client
        .update(userTable)
        .set({ aiUsageCount: 0, aiUsageResetAt: instantFromDate(oldMonthAt) })
        .where(eq(userTable.id, userId));
      const previous = await ledger.reserve(input());
      const previousVoice = await ledger.reserve(input({ feature: "VOICE_NOTE" }));
      vi.setSystemTime(newMonthAt);
      await ledger.reserve(input());
      await ledger.reserve(input({ feature: "VOICE_NOTE" }));

      // When
      await ledger.refund(previous, "FAILED");
      await ledger.refund(previousVoice, "FAILED");

      // Then
      expect(await storedAiUsage()).toEqual({ count: 1, resetAt: newMonthAt });
      expect(await storedVoiceUsage()).toBe(1);
      expect(await storedVoiceUsage(periodKeyOf(oldMonthAt))).toBe(0);
    });

    it("AI_PLAN 카운터 차감은 같은 기간이고 남은 횟수가 있을 때만 적용한다", async () => {
      // Given
      await client.update(userTable).set({ aiUsageCount: 1 }).where(eq(userTable.id, userId));
      const oldPeriod = periodKeyOf(oldMonthAt);
      const currentPeriod = periodKeyOf(newMonthAt);

      // When
      const wrongPeriod = await usageRepository.subtractUsage({
        userId: UserId.reconstitute(userId),
        meter: "AI_PLAN",
        periodKey: oldPeriod,
        amount: 1,
        now: instantFromDate(newMonthAt),
      });
      const tooMany = await usageRepository.subtractUsage({
        userId: UserId.reconstitute(userId),
        meter: "AI_PLAN",
        periodKey: currentPeriod,
        amount: 2,
        now: instantFromDate(newMonthAt),
      });
      const applied = await usageRepository.subtractUsage({
        userId: UserId.reconstitute(userId),
        meter: "AI_PLAN",
        periodKey: currentPeriod,
        amount: 1,
        now: instantFromDate(newMonthAt),
      });

      // Then
      expect([wrongPeriod, tooMany, applied]).toEqual([false, false, true]);
      expect((await storedAiUsage())?.count).toBe(0);
    });
  });

  describe("같은 Idempotency-Key", () => {
    it("확정된 키를 다시 보내면 새 차감 없이 이미 확정된 예약을 돌려준다", async () => {
      // Given
      const first = await ledger.reserve(input({ feature: "VOICE_NOTE", idempotencyKey: "k-1" }));
      await ledger.commit(first);

      // When
      const replay = await ledger.reserve(input({ feature: "VOICE_NOTE", idempotencyKey: "k-1" }));

      // Then
      expect(replay).toMatchObject({ chargeId: first.chargeId, isAlreadyCommitted: true });
      expect(await storedVoiceUsage()).toBe(1);
      expect(await storedCharges()).toHaveLength(1);
    });

    it("같은 키의 동시 두 요청은 하나만 차감하고 다른 요청은 AI_1314다", async () => {
      // When
      const { outcomes } = await contend(() =>
        ledger.reserve(input({ feature: "VOICE_NOTE", idempotencyKey: "k-2" })),
      );

      // Then
      expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
      expect(outcomes.find((outcome) => outcome.status === "rejected")).toMatchObject({
        reason: { errorCode: ErrorCode.AI_1314, details: { charged: false } },
      });
      expect(await storedVoiceUsage()).toBe(1);
      expect(await storedCharges()).toHaveLength(1);
    });

    it("결과를 잃어 다시 열면 같은 행을 재사용하고 추가 차감이 없으며 동시 재열기는 하나만 된다", async () => {
      // Given
      const key = input({ feature: "VOICE_NOTE", idempotencyKey: "reopen-key" });
      await ledger.commit(await ledger.reserve(key));
      const committed = await ledger.reserve(key);
      // When
      const outcomes = await Promise.allSettled([
        ledger.reopen(committed),
        ledger.reopen(committed),
      ]);
      // Then
      const reopened = outcomes.flatMap((outcome) =>
        outcome.status === "fulfilled" ? [outcome.value] : [],
      );
      expect(reopened).toEqual([
        expect.objectContaining({ attempt: 2, isAlreadyCommitted: false }),
      ]);
      expect(outcomes.filter(({ status }) => status === "rejected")).toEqual([
        expect.objectContaining({
          reason: expect.objectContaining({ errorCode: ErrorCode.AI_1314 }),
        }),
      ]);
      const [winner] = reopened;
      expect(winner != null && (await ledger.commit(winner))).toBe(true);
      expect((await ledger.read(UserId.reconstitute(userId), "VOICE_NOTE")).used).toBe(1);
    });

    it("다시 연 예약을 환불하면 앞선 차감까지 돌아간다", async () => {
      // Given
      const key = input({ feature: "VOICE_NOTE", idempotencyKey: "reopen-refund" });
      await ledger.commit(await ledger.reserve(key));
      const committed = await ledger.reserve(key);
      // When
      const refunded = await ledger.refund(await ledger.reopen(committed), "FAILED");
      // Then
      expect(refunded).toBe(true);
      expect((await ledger.read(UserId.reconstitute(userId), "VOICE_NOTE")).used).toBe(0);
    });

    it("환불된 키는 같은 행에서 다시 차감해 순 차감이 한 번이다", async () => {
      // Given
      const first = await ledger.reserve(input({ feature: "VOICE_NOTE", idempotencyKey: "k-3" }));
      await ledger.refund(first, "FAILED");

      // When
      const retry = await ledger.reserve(input({ feature: "VOICE_NOTE", idempotencyKey: "k-3" }));
      await ledger.commit(retry);

      // Then
      expect(retry).toMatchObject({ chargeId: first.chargeId, attempt: 2 });
      expect(await storedVoiceUsage()).toBe(1);
      expect(await storedCharges()).toMatchObject([
        { status: "COMMITTED", attempt: 2, refundReason: null },
      ]);
    });

    it.each([
      { feature: "AI_PARSE", label: "AI_PLAN" },
      { feature: "VOICE_NOTE", label: "VOICE_NOTE" },
    ] as const)(
      "$label 예약을 달을 넘겨 이어받으면 새 달 사용량으로 다시 잡고 환불도 새 달에 돌려준다",
      async ({ feature }) => {
        // Given
        const reserveInput = input({ feature, idempotencyKey: "cross-month", requestHash: "hash" });
        const stalledAt = new Date(newMonthAt.getTime() - QUOTA_RESERVATION_TAKEOVER_AFTER_MS);
        vi.setSystemTime(stalledAt);
        await client
          .update(userTable)
          .set({ aiUsageCount: 0, aiUsageResetAt: instantFromDate(stalledAt) })
          .where(eq(userTable.id, userId));
        await ledger.reserve(reserveInput);
        vi.setSystemTime(newMonthAt);
        // When
        const takenOver = await ledger.reserve(reserveInput);
        const quotaAfterTakeOver = await ledger.read(UserId.reconstitute(userId), feature);
        const refunded = await ledger.refund(takenOver, "FAILED");
        // Then
        const [charge] = await storedCharges();
        expect(takenOver.attempt).toBe(2);
        expect(quotaAfterTakeOver.used).toBe(1);
        expect(charge?.periodKey).toBe(periodKeyOf(newMonthAt));
        expect(refunded).toBe(true);
        expect((await ledger.read(UserId.reconstitute(userId), feature)).used).toBe(0);
      },
    );

    it("같은 키로 내용이 다른 요청은 AI_1318이고 차감하지 않는다", async () => {
      // Given
      const reserveInput = input({
        feature: "VOICE_NOTE",
        idempotencyKey: "reused",
        requestHash: "hash-a",
      });
      await ledger.reserve(reserveInput);
      // When
      const reused = ledger.reserve({ ...reserveInput, requestHash: "hash-b" });
      // Then
      await expect(reused).rejects.toMatchObject({
        errorCode: ErrorCode.AI_1318,
        details: { charged: false },
      });
      expect(await storedVoiceUsage()).toBe(1);
    });

    it("키 없는 요청은 여러 행을 남기고 같은 사용자·계량기의 같은 키는 DB가 한 행만 허용한다", async () => {
      // Given
      await ledger.reserve(input());
      await ledger.reserve(input({ feature: "VOICE_NOTE" }));
      const duplicate = {
        userId,
        meter: "VOICE_NOTE",
        idempotencyKey: "k-4",
        amount: 1,
        attempt: 1,
        periodKey: "2026-M10",
        reason: "test",
        status: "RESERVED",
        updatedAt: instantFromDate(newMonthAt),
      } as const;
      await client.insert(quotaCharge).values(duplicate);

      // When
      const inserted = client.insert(quotaCharge).values(duplicate);

      // Then
      await expect(inserted).rejects.toSatisfy(isUniqueConstraintViolation);
      expect(await storedCharges()).toHaveLength(3);
    });
  });

  describe("계량기와 기간", () => {
    it("AI_PARSE는 출시 앱과 같은 User.aiUsageCount를, VOICE_NOTE는 QuotaUsage를 센다", async () => {
      // When
      await ledger.reserve(input({ feature: "VOICE_NOTE" }));
      const aiQuota = await ledger.read(UserId.reconstitute(userId), "AI_PARSE");

      // Then
      expect((await storedAiUsage())?.count).toBe(FREE_AI_LIMIT - 1);
      expect(aiQuota.used).toBe(FREE_AI_LIMIT - 1);
      expect(await storedVoiceUsage()).toBe(1);
      expect(await client.select().from(quotaUsage).where(eq(quotaUsage.meter, "AI_PLAN"))).toEqual(
        [],
      );
    });

    it("KST 새 달 조회는 0과 다음 리셋 시각을 반환하고 저장된 카운터는 바꾸지 않는다", async () => {
      // Given
      await client
        .update(userTable)
        .set({ aiUsageCount: FREE_AI_LIMIT, aiUsageResetAt: instantFromDate(oldMonthAt) })
        .where(eq(userTable.id, userId));

      // When
      const quota = await ledger.read(UserId.reconstitute(userId), "AI_PARSE");

      // Then
      expect(quota).toMatchObject({
        used: 0,
        limit: FREE_AI_LIMIT,
        remaining: FREE_AI_LIMIT,
        resetsAt: "2026-10-31T15:00:00.000Z",
      });
      expect(await storedAiUsage()).toEqual({ count: FREE_AI_LIMIT, resetAt: oldMonthAt });
    });

    it("QuotaUsage 원자적 증가는 DB 조건으로도 한도를 넘지 않는다", async () => {
      // Given
      const window = QuotaWindow.monthOf(instantFromDate(newMonthAt));
      const add = () =>
        usageRepository.addUsageWithinLimit({
          userId: UserId.reconstitute(userId),
          meter: "VOICE_NOTE",
          window,
          amount: 1,
          limit: 1,
          now: instantFromDate(newMonthAt),
        });

      // When
      const results = [await add(), await add()];

      // Then
      expect(results).toEqual([true, false]);
      expect(await storedVoiceUsage()).toBe(1);
    });
  });

  describe("권한·트랜잭션", () => {
    it.each([
      { name: "ADMIN", role: "ADMIN", subscriptionStatus: "FREE" },
      { name: "ACTIVE", role: "USER", subscriptionStatus: "ACTIVE" },
    ] satisfies Array<{
      name: string;
      role: "USER" | "ADMIN";
      subscriptionStatus: "FREE" | "ACTIVE";
    }>)(
      "캐시에 남은 $name 권한보다 잠금 안의 최신 무료 한도를 적용한다",
      async ({ role, subscriptionStatus }) => {
        // Given
        await client
          .update(userTable)
          .set({ role, subscriptionStatus, aiUsageCount: FREE_AI_LIMIT })
          .where(eq(userTable.id, userId));
        expect(
          await entitlement.getFeatureLimit(UserId.reconstitute(userId), "AI_PARSE"),
        ).toBeNull();
        await client
          .update(userTable)
          .set({ role: "USER", subscriptionStatus: "FREE" })
          .where(eq(userTable.id, userId));

        // When
        const execution = ledger.reserve(input());

        // Then
        await expect(execution).rejects.toMatchObject({
          errorCode: ErrorCode.AI_1303,
          details: { featureQuota: { used: FREE_AI_LIMIT, limit: FREE_AI_LIMIT } },
        });
        expect((await storedAiUsage())?.count).toBe(FREE_AI_LIMIT);
      },
    );

    it("보상 기간 동안은 무료 한도를 넘고 끝나는 시각부터 sweep 전에도 무료 한도로 막는다", async () => {
      // Given
      await client
        .update(userTable)
        .set({ aiUsageCount: FREE_AI_LIMIT })
        .where(eq(userTable.id, userId));
      await context.module.get<PremiumGranterPort>(PremiumGranterPort).grant({
        userId: UserId.reconstitute(userId),
        source: "INVITE",
        sourceKey: "invite:quota-ledger",
        durationDays: 7,
      });
      const grantEndsAt = new Date(newMonthAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      vi.setSystemTime(new Date(grantEndsAt.getTime() - 1));
      const duringGrant = await ledger.read(UserId.reconstitute(userId), "AI_PARSE");

      // When
      await ledger.reserve(input());
      vi.setSystemTime(grantEndsAt);
      const afterGrant = ledger.reserve(input());

      // Then
      expect(duringGrant).toMatchObject({
        limit: PLAN_CATALOG.AI_PARSE.fairUse.premium,
        isFairUse: true,
      });
      await expect(afterGrant).rejects.toMatchObject({
        errorCode: ErrorCode.AI_1303,
        details: { featureQuota: { limit: FREE_AI_LIMIT, isFairUse: false } },
      });
    });

    it("상위 트랜잭션이 실패하면 예약의 카운터 증가와 원장 행도 rollback한다", async () => {
      // Given
      const failure = new Error("업무 트랜잭션 실패");

      // When
      const execution = unitOfWork.run(async () => {
        await ledger.reserve(input());
        throw failure;
      });

      // Then
      await expect(execution).rejects.toBe(failure);
      expect((await storedAiUsage())?.count).toBe(FREE_AI_LIMIT - 1);
      expect(await storedCharges()).toEqual([]);
    });

    it("없는 사용자의 예약은 USER_0601이고 사용자를 지우면 원장과 카운터도 함께 지워진다", async () => {
      // Given
      await ledger.reserve(input({ feature: "VOICE_NOTE" }));
      await client.delete(userTable).where(eq(userTable.id, userId));

      // When
      const execution = ledger.reserve(input());

      // Then
      await expect(execution).rejects.toMatchObject({
        errorCode: ErrorCode.USER_0601,
        details: { userId },
      });
      expect(await storedCharges()).toEqual([]);
      expect(await storedVoiceUsage()).toBe(0);
    });
  });
});
