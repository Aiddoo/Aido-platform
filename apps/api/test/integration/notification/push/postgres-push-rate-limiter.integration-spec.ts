import { and, count, eq, type SQL } from "drizzle-orm";

import { PostgresPushRateLimiterAdapter } from "#api/modules/notification/push/infrastructure/adapters/postgres-push-rate-limiter.adapter";
import {
  notification,
  pushDispatch,
  pushRateLimitReservation,
  user,
} from "#api/platform/database/schema/index";
import type { TestDatabaseClient } from "#test/setup/test-database";
import { TestDatabase } from "#test/setup/test-database";

describe("PostgresPushRateLimiterAdapter (실제 PostgreSQL)", () => {
  let testDatabase: TestDatabase;
  let client: TestDatabaseClient;
  let limiter: PostgresPushRateLimiterAdapter;

  beforeAll(async () => {
    testDatabase = new TestDatabase();
    client = await testDatabase.start();
    limiter = new PostgresPushRateLimiterAdapter(client);
  });

  afterAll(async () => testDatabase?.stop());
  beforeEach(async () => testDatabase.cleanup());

  async function createUser(suffix: string): Promise<string> {
    const [created] = await client
      .insert(user)
      .values({
        email: `rate-limit-${suffix}@example.com`,
        userTag: suffix.padEnd(8, "X").slice(0, 8),
        updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
        status: "ACTIVE",
      })
      .returning({ id: user.id });
    if (created === undefined) {
      throw new Error("user was not created");
    }
    return created.id;
  }

  async function createDispatch(userId: string, suffix: string): Promise<number> {
    const [createdNotification] = await client
      .insert(notification)
      .values({ userId, type: "SYSTEM_NOTICE", title: suffix, body: suffix })
      .returning({ id: notification.id });
    if (createdNotification === undefined) {
      throw new Error("notification was not created");
    }
    const [dispatch] = await client
      .insert(pushDispatch)
      .values({ notificationId: createdNotification.id, userId, purpose: "ENGAGEMENT" })
      .returning({ id: pushDispatch.id });
    if (dispatch === undefined) {
      throw new Error("dispatch was not created");
    }
    return dispatch.id;
  }

  async function countReservations(where?: SQL): Promise<number> {
    const [row] = await client
      .select({ total: count() })
      .from(pushRateLimitReservation)
      .where(where);
    return row?.total ?? 0;
  }

  it("재시작 후 같은 dispatch를 재시도해도 quota를 한 번만 예약한다", async () => {
    const userId = await createUser("retry");
    const dispatchId = await createDispatch(userId, "retry");

    await expect(limiter.reserveGeneral({ dispatchId, userId })).resolves.toBe(false);
    const restarted = new PostgresPushRateLimiterAdapter(client);
    await expect(restarted.reserveGeneral({ dispatchId, userId })).resolves.toBe(false);

    await expect(
      countReservations(
        and(
          eq(pushRateLimitReservation.dispatchId, dispatchId),
          eq(pushRateLimitReservation.phase, "GENERAL"),
        ),
      ),
    ).resolves.toBe(1);
  });

  it("동일 사용자의 경계 동시 요청을 Serializable 재시도로 정확히 한 건만 허용한다", async () => {
    const userId = await createUser("race");
    const dispatchIds = await Promise.all(
      Array.from({ length: 16 }, (_, index) => createDispatch(userId, `race-${index}`)),
    );
    for (const dispatchId of dispatchIds.slice(0, 14)) {
      await expect(limiter.reserveGeneral({ dispatchId, userId })).resolves.toBe(false);
    }

    const decisions = await Promise.all(
      dispatchIds.slice(14).map((dispatchId) => limiter.reserveGeneral({ dispatchId, userId })),
    );
    expect(decisions.toSorted()).toEqual([false, true]);
    await expect(
      countReservations(
        and(
          eq(pushRateLimitReservation.userId, userId),
          eq(pushRateLimitReservation.phase, "GENERAL"),
        ),
      ),
    ).resolves.toBe(15);
  });

  it("배치 예약은 서로 다른 사용자를 한 트랜잭션에서 일반·engagement로 저장한다", async () => {
    const firstUserId = await createUser("batch-a");
    const secondUserId = await createUser("batch-b");
    const firstDispatchId = await createDispatch(firstUserId, "batch-a");
    const secondDispatchId = await createDispatch(secondUserId, "batch-b");

    await expect(
      limiter.reserveBatch([
        {
          dispatchId: firstDispatchId,
          userId: firstUserId,
          engagementLocalDate: "2026-08-29",
        },
        { dispatchId: secondDispatchId, userId: secondUserId },
      ]),
    ).resolves.toEqual([false, false]);
    await expect(countReservations()).resolves.toBe(3);
  });
});
