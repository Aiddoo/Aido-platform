import { Propagation, type TransactionHost } from "@nestjs-cls/transactional";
import { eq, sql } from "drizzle-orm";
import { vi } from "vitest";

import { DrizzlePushDeliveryLifecycleRepository } from "#api/modules/notification/push/infrastructure/persistence/drizzle-push-delivery-lifecycle.repository";
import { DrizzlePushDeliveryOutboxRepository } from "#api/modules/notification/push/infrastructure/persistence/drizzle-push-delivery-outbox.repository";
import { DrizzlePushDispatchStagingRepository } from "#api/modules/notification/push/infrastructure/persistence/drizzle-push-dispatch-staging.repository";
import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import {
  notification as notificationTable,
  pushDispatch,
  pushDispatchOutbox,
  user as userTable,
} from "#api/platform/database/schema/index";
import { createTransactionHost } from "#test/setup/database-context";
import type { TestDatabaseClient } from "#test/setup/test-database";
import { TestDatabase } from "#test/setup/test-database";

interface Deferred {
  readonly promise: Promise<void>;
  resolve(): void;
}

interface TrackedPromise<T> {
  readonly promise: Promise<T>;
  isSettled(): boolean;
}

function deferred(): Deferred {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: () => resolvePromise?.(),
  };
}

async function waitUntilTransactionHoldsLock(
  barrier: Deferred,
  transaction: Promise<unknown>,
  operation: string,
): Promise<void> {
  await Promise.race([
    barrier.promise,
    transaction.then(() => {
      throw new Error(`${operation} transaction completed before reaching its barrier`);
    }),
  ]);
}

async function waitForBlockedDatabaseQuery(db: TestDatabaseClient): Promise<void> {
  await vi.waitFor(
    async () => {
      const waiting = await db.execute<{ blocked: boolean }>(sql`
        SELECT EXISTS (
          SELECT 1 FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'
        ) AS blocked
      `);
      expect(waiting.rows[0]?.blocked).toBe(true);
    },
    { timeout: 5_000, interval: 10 },
  );
}

function trackSettlement<T>(promise: Promise<T>): TrackedPromise<T> {
  let settled = false;
  return {
    promise: promise.then(
      (value) => {
        settled = true;
        return value;
      },
      (error: unknown) => {
        settled = true;
        throw error;
      },
    ),
    isSettled: () => settled,
  };
}

type DatabaseTransactionHost = TransactionHost<DrizzleTransactionalAdapter>;

function staging(host: DatabaseTransactionHost): DrizzlePushDispatchStagingRepository {
  return new DrizzlePushDispatchStagingRepository(host);
}

function outbox(host: DatabaseTransactionHost): DrizzlePushDeliveryOutboxRepository {
  return new DrizzlePushDeliveryOutboxRepository(host);
}

function lifecycle(host: DatabaseTransactionHost): DrizzlePushDeliveryLifecycleRepository {
  return new DrizzlePushDeliveryLifecycleRepository(host);
}

describe("일반 push delivery outbox (실제 PostgreSQL)", () => {
  let testDatabase: TestDatabase;
  let db: TestDatabaseClient;
  let host: DatabaseTransactionHost;

  beforeAll(async () => {
    testDatabase = new TestDatabase();
    db = await testDatabase.start();
    host = createTransactionHost(db);
  });

  // db.transaction처럼 호출마다 새 트랜잭션을 열어 동시 claim 경합을 그대로 만든다
  function inTransaction<T>(work: () => Promise<T>): Promise<T> {
    return host.withTransaction(Propagation.RequiresNew, work);
  }

  afterAll(async () => {
    await testDatabase?.stop();
  });

  beforeEach(async () => {
    await testDatabase.cleanup();
  });

  async function createUser(suffix: string): Promise<{ id: string }> {
    const [created] = await db
      .insert(userTable)
      .values({
        email: `push-outbox-${suffix}@example.com`,
        userTag: suffix.padEnd(8, "X").slice(0, 8),
        updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
        status: "ACTIVE",
      })
      .returning({ id: userTable.id });
    return requireRecord(created);
  }

  async function createNotification(
    userId: string,
    suffix: string,
    type: "SYSTEM_NOTICE" | "ADMIN_BROADCAST" = "SYSTEM_NOTICE",
  ) {
    const [created] = await db
      .insert(notificationTable)
      .values({
        userId,
        type,
        title: `title-${suffix}`,
        body: `body-${suffix}`,
      })
      .returning();
    return requireRecord(created);
  }

  async function stageNotification(input: {
    readonly userId: string;
    readonly suffix: string;
    readonly deliveryMode?: "SINGLE" | "BATCH";
    readonly force?: boolean;
    readonly purpose?: "TRANSACTIONAL" | "ENGAGEMENT";
    readonly type?: "SYSTEM_NOTICE" | "ADMIN_BROADCAST";
  }) {
    const notification = await createNotification(input.userId, input.suffix, input.type);
    return staging(host).stage({
      notificationId: notification.id,
      userId: input.userId,
      purpose: input.purpose ?? "TRANSACTIONAL",
      deliveryMode: input.deliveryMode ?? "SINGLE",
      force: input.force ?? false,
    });
  }

  async function expectGeneralOwnershipState(
    dispatchId: number,
    expected: {
      readonly outboxStatus: "PENDING" | "PROCESSING" | "PUBLISHED";
      readonly dispatchStatus: "PENDING" | "PROCESSING" | "SKIPPED";
    },
  ): Promise<void> {
    const [dispatch, dispatchOutbox] = await Promise.all([
      db.query.pushDispatch
        .findFirst({ where: { id: dispatchId } })
        .then((row) => requireRecord(row)),
      db.query.pushDispatchOutbox
        .findFirst({ where: { dispatchId: dispatchId } })
        .then((row) => requireRecord(row)),
    ]);
    expect({ outboxStatus: dispatchOutbox.status, dispatchStatus: dispatch.status }).toEqual(
      expected,
    );
    expect(dispatchOutbox.status === "PENDING" && dispatch.status === "PROCESSING").toBe(false);
  }

  it("notification, dispatch, outbox를 함께 commit하고 실패 시 모두 rollback한다", async () => {
    const committedUser = await createUser("COMMIT01");
    await inTransaction(async () => {
      const [created] = await host.tx
        .insert(notificationTable)
        .values({
          userId: committedUser.id,
          type: "SYSTEM_NOTICE",
          title: "committed",
          body: "committed",
        })
        .returning();
      const notification = requireRecord(created);
      await staging(host).stage({
        notificationId: notification.id,
        userId: committedUser.id,
        purpose: "TRANSACTIONAL",
        deliveryMode: "SINGLE",
        force: false,
      });
    });

    await expect(
      db.$count(notificationTable, eq(notificationTable.userId, committedUser.id)),
    ).resolves.toBe(1);
    await expect(db.$count(pushDispatch, eq(pushDispatch.userId, committedUser.id))).resolves.toBe(
      1,
    );
    await expect(db.$count(pushDispatchOutbox)).resolves.toBe(1);

    const rolledBackUser = await createUser("ROLLBACK");
    await expect(
      inTransaction(async () => {
        const [created] = await host.tx
          .insert(notificationTable)
          .values({
            userId: rolledBackUser.id,
            type: "SYSTEM_NOTICE",
            title: "rolled-back",
            body: "rolled-back",
          })
          .returning();
        const notification = requireRecord(created);
        await staging(host).stage({
          notificationId: notification.id,
          userId: rolledBackUser.id,
          purpose: "TRANSACTIONAL",
          deliveryMode: "BATCH",
          force: true,
        });
        throw new Error("rollback transaction");
      }),
    ).rejects.toThrow("rollback transaction");

    await expect(
      db.$count(notificationTable, eq(notificationTable.userId, rolledBackUser.id)),
    ).resolves.toBe(0);
    await expect(db.$count(pushDispatch, eq(pushDispatch.userId, rolledBackUser.id))).resolves.toBe(
      0,
    );
    await expect(db.$count(pushDispatchOutbox)).resolves.toBe(1);
  });

  it("방금 stage한 outbox도 같은 ms 정밀도로 비교해 바로 claim한다", async () => {
    // Given
    // availableAt은 timestamp(3)이라 기본값 now()가 ms로 반올림(절반은 올림)되어 저장된다.
    // 같은 트랜잭션은 now()가 같아 stage 직후 claim하는 가장 짧은 간격을 매번 재현한다
    const user = await createUser("PRECISE1");
    const notifications = await Promise.all(
      Array.from({ length: 200 }, (_, index) => createNotification(user.id, `precise-${index}`)),
    );

    // When
    const missed: number[] = [];
    for (const notification of notifications) {
      await inTransaction(async () => {
        const { dispatchId } = await staging(host).stage({
          notificationId: notification.id,
          userId: user.id,
          purpose: "TRANSACTIONAL",
          deliveryMode: "SINGLE",
          force: false,
        });
        const claimed = await outbox(host).claimByDispatchIds([dispatchId], new Date());
        if (claimed.length === 0) {
          missed.push(dispatchId);
        }
      });
    }

    // Then
    expect(missed).toEqual([]);
  });

  it("claim은 dispatch purpose와 알림 타입으로 발송 차선을 함께 돌려준다", async () => {
    // Given
    const user = await createUser("LANES001");
    const reminder = await stageNotification({ userId: user.id, suffix: "reminder" });
    const engagement = await stageNotification({
      userId: user.id,
      suffix: "engagement",
      purpose: "ENGAGEMENT",
    });
    const broadcast = await stageNotification({
      userId: user.id,
      suffix: "broadcast",
      type: "ADMIN_BROADCAST",
    });

    // When
    const claimed = await inTransaction(() =>
      outbox(host).claimAvailable({ limit: 10, lockedAt: new Date() }),
    );

    // Then
    expect(Object.fromEntries(claimed.map(({ dispatchId, lane }) => [dispatchId, lane]))).toEqual({
      [reminder.dispatchId]: "TRANSACTIONAL",
      [engagement.dispatchId]: "MARKETING",
      [broadcast.dispatchId]: "MARKETING",
    });
  });

  it("동시 relay claim은 SKIP LOCKED로 같은 outbox를 중복 소유하지 않는다", async () => {
    const user = await createUser("LOCKED01");
    const first = await stageNotification({ userId: user.id, suffix: "first" });
    const second = await stageNotification({ userId: user.id, suffix: "second" });
    const firstClaimed = deferred();
    const releaseFirst = deferred();
    const lockedAt = new Date(Date.now() + 1_000);

    const firstTransaction = inTransaction(async () => {
      const claimed = await outbox(host).claimAvailable({ limit: 1, lockedAt });
      firstClaimed.resolve();
      await releaseFirst.promise;
      return claimed;
    });
    await firstClaimed.promise;
    const secondClaim = await inTransaction(() =>
      outbox(host).claimAvailable({ limit: 2, lockedAt }),
    );
    releaseFirst.resolve();
    const firstClaim = await firstTransaction;

    expect(firstClaim).toHaveLength(1);
    expect(secondClaim).toHaveLength(1);
    expect(new Set([...firstClaim, ...secondClaim].map((item) => item.dispatchId))).toEqual(
      new Set([first.dispatchId, second.dispatchId]),
    );
  });

  it("worker claim이 outbox lock을 먼저 잡으면 stale recovery는 해당 generation을 건너뛴다", async () => {
    const user = await createUser("OWNCLM01");
    const staged = await stageNotification({ userId: user.id, suffix: "claim-first" });
    const staleLockedAt = new Date("2026-08-29T00:00:00.000Z");
    const publication = await inTransaction(() =>
      outbox(host).claimByDispatchIds([staged.dispatchId], staleLockedAt),
    );
    const claimOwnsRows = deferred();
    const releaseClaim = deferred();
    const claimTransaction = inTransaction(async () => {
      const claimed = await lifecycle(host).claim({
        publications: publication,
        processingJobId: "general-claim-first",
        processingJobAttempt: 1,
        startedAt: new Date("2026-08-29T00:20:00.000Z"),
      });
      claimOwnsRows.resolve();
      await releaseClaim.promise;
      return claimed;
    });

    let recovered = -1;
    try {
      await waitUntilTransactionHoldsLock(claimOwnsRows, claimTransaction, "general claim");
      recovered = await inTransaction(() =>
        outbox(host).recoverStaleProcessing(new Date("2026-08-29T00:15:00.000Z")),
      );
    } finally {
      releaseClaim.resolve();
    }
    const claimed = await claimTransaction;

    expect(recovered).toBe(0);
    expect(claimed).toHaveLength(1);
    await expectGeneralOwnershipState(staged.dispatchId, {
      outboxStatus: "PUBLISHED",
      dispatchStatus: "PROCESSING",
    });
  });

  it("stale recovery가 outbox lock을 먼저 잡으면 worker claim은 복구된 generation을 소유하지 않는다", async () => {
    const user = await createUser("OWNRCV01");
    const staged = await stageNotification({ userId: user.id, suffix: "recovery-first" });
    const publication = await inTransaction(() =>
      outbox(host).claimByDispatchIds([staged.dispatchId], new Date("2026-08-29T00:00:00.000Z")),
    );
    const recoveryOwnsOutbox = deferred();
    const releaseRecovery = deferred();
    const recoveryTransaction = inTransaction(async () => {
      const recovered = await outbox(host).recoverStaleProcessing(
        new Date("2026-08-29T00:15:00.000Z"),
      );
      recoveryOwnsOutbox.resolve();
      await releaseRecovery.promise;
      return recovered;
    });

    await waitUntilTransactionHoldsLock(
      recoveryOwnsOutbox,
      recoveryTransaction,
      "general recovery",
    );
    const claimStarted = deferred();
    const trackedClaim = trackSettlement(
      inTransaction(async () => {
        claimStarted.resolve();
        return lifecycle(host).claim({
          publications: publication,
          processingJobId: "general-recovery-first",
          processingJobAttempt: 1,
          startedAt: new Date("2026-08-29T00:20:00.000Z"),
        });
      }),
    );
    let claimWaitedForRecovery = false;
    try {
      await claimStarted.promise;
      await waitForBlockedDatabaseQuery(db);
      claimWaitedForRecovery = !trackedClaim.isSettled();
    } finally {
      releaseRecovery.resolve();
    }
    const [recovered, claimed] = await Promise.all([recoveryTransaction, trackedClaim.promise]);

    expect(claimWaitedForRecovery).toBe(true);
    expect(recovered).toBe(1);
    expect(claimed).toEqual([]);
    await expectGeneralOwnershipState(staged.dispatchId, {
      outboxStatus: "PENDING",
      dispatchStatus: "PENDING",
    });
  });

  it("worker claim이 먼저 commit되면 늦게 도착한 enqueue defer는 소유권을 되돌리지 않는다", async () => {
    const user = await createUser("OWNDEF01");
    const staged = await stageNotification({ userId: user.id, suffix: "claim-before-defer" });
    const publication = await inTransaction(() =>
      outbox(host).claimByDispatchIds([staged.dispatchId], new Date()),
    );
    const claimOwnsRows = deferred();
    const releaseClaim = deferred();
    const claimTransaction = inTransaction(async () => {
      const claimed = await lifecycle(host).claim({
        publications: publication,
        processingJobId: "general-claim-before-defer",
        processingJobAttempt: 1,
        startedAt: new Date(),
      });
      claimOwnsRows.resolve();
      await releaseClaim.promise;
      return claimed;
    });

    await waitUntilTransactionHoldsLock(claimOwnsRows, claimTransaction, "general claim");
    const deferStarted = deferred();
    const trackedDefer = trackSettlement(
      inTransaction(async () => {
        deferStarted.resolve();
        return outbox(host).defer({
          publications: publication,
          availableAt: new Date(Date.now() + 60_000),
          error: "ambiguous enqueue result",
        });
      }),
    );
    let deferWaitedForClaim = false;
    try {
      await deferStarted.promise;
      await waitForBlockedDatabaseQuery(db);
      deferWaitedForClaim = !trackedDefer.isSettled();
    } finally {
      releaseClaim.resolve();
    }
    const [claimed, deferredCount] = await Promise.all([claimTransaction, trackedDefer.promise]);

    expect(deferWaitedForClaim).toBe(true);
    expect(claimed).toHaveLength(1);
    expect(deferredCount).toBe(0);
    await expectGeneralOwnershipState(staged.dispatchId, {
      outboxStatus: "PUBLISHED",
      dispatchStatus: "PROCESSING",
    });
  });

  it("enqueue defer가 먼저 commit되면 worker claim은 되돌려진 generation을 소유하지 않는다", async () => {
    const user = await createUser("OWNDEF02");
    const staged = await stageNotification({ userId: user.id, suffix: "defer-before-claim" });
    const publication = await inTransaction(() =>
      outbox(host).claimByDispatchIds([staged.dispatchId], new Date()),
    );
    const deferOwnsOutbox = deferred();
    const releaseDefer = deferred();
    const deferTransaction = inTransaction(async () => {
      const deferredCount = await outbox(host).defer({
        publications: publication,
        availableAt: new Date(Date.now() + 60_000),
        error: "queue rejected enqueue",
      });
      deferOwnsOutbox.resolve();
      await releaseDefer.promise;
      return deferredCount;
    });

    await waitUntilTransactionHoldsLock(deferOwnsOutbox, deferTransaction, "general defer");
    const claimStarted = deferred();
    const trackedClaim = trackSettlement(
      inTransaction(async () => {
        claimStarted.resolve();
        return lifecycle(host).claim({
          publications: publication,
          processingJobId: "general-defer-before-claim",
          processingJobAttempt: 1,
          startedAt: new Date(),
        });
      }),
    );
    let claimWaitedForDefer = false;
    try {
      await claimStarted.promise;
      await waitForBlockedDatabaseQuery(db);
      claimWaitedForDefer = !trackedClaim.isSettled();
    } finally {
      releaseDefer.resolve();
    }
    const [deferredCount, claimed] = await Promise.all([deferTransaction, trackedClaim.promise]);

    expect(claimWaitedForDefer).toBe(true);
    expect(deferredCount).toBe(1);
    expect(claimed).toEqual([]);
    await expectGeneralOwnershipState(staged.dispatchId, {
      outboxStatus: "PENDING",
      dispatchStatus: "PENDING",
    });
  });

  it("terminal finalize와 same-job retry claim은 outbox부터 직렬화해 stale worker 덮어쓰기를 막는다", async () => {
    const user = await createUser("TERMRACE");
    const terminalFirst = await stageNotification({
      userId: user.id,
      suffix: "terminal-first",
    });
    const terminalPublication = await inTransaction(() =>
      outbox(host).claimByDispatchIds([terminalFirst.dispatchId], new Date()),
    );
    await inTransaction(() => outbox(host).markPublished(terminalPublication, new Date()));
    const [terminalInitialClaim] = await inTransaction(() =>
      lifecycle(host).claim({
        publications: terminalPublication,
        processingJobId: "terminal-first-job",
        processingJobAttempt: 1,
        startedAt: new Date(),
      }),
    );
    if (!terminalInitialClaim) {
      throw new Error("Expected terminal-first initial claim");
    }

    const terminalOwnsRows = deferred();
    const releaseTerminal = deferred();
    const terminalTransaction = inTransaction(async () => {
      const finalized = await lifecycle(host).finalizeSkipped([
        {
          fence: terminalInitialClaim.fence,
          context: { timezone: "UTC", localDate: new Date("2026-08-29T00:00:00Z") },
          reason: "NO_ACTIVE_TOKEN",
        },
      ]);
      terminalOwnsRows.resolve();
      await releaseTerminal.promise;
      return finalized;
    });
    await waitUntilTransactionHoldsLock(terminalOwnsRows, terminalTransaction, "terminal finalize");
    const terminalRetryStarted = deferred();
    const terminalRetry = trackSettlement(
      inTransaction(async () => {
        terminalRetryStarted.resolve();
        return lifecycle(host).claim({
          publications: terminalPublication,
          processingJobId: "terminal-first-job",
          processingJobAttempt: 2,
          startedAt: new Date(),
        });
      }),
    );
    let retryWaitedForTerminal = false;
    try {
      await terminalRetryStarted.promise;
      await waitForBlockedDatabaseQuery(db);
      retryWaitedForTerminal = !terminalRetry.isSettled();
    } finally {
      releaseTerminal.resolve();
    }
    const [finalized, staleRetry] = await Promise.all([terminalTransaction, terminalRetry.promise]);
    expect(retryWaitedForTerminal).toBe(true);
    expect(finalized).toBe(1);
    expect(staleRetry).toEqual([]);
    await expectGeneralOwnershipState(terminalFirst.dispatchId, {
      outboxStatus: "PUBLISHED",
      dispatchStatus: "SKIPPED",
    });

    const claimFirst = await stageNotification({ userId: user.id, suffix: "claim-first" });
    const claimPublication = await inTransaction(() =>
      outbox(host).claimByDispatchIds([claimFirst.dispatchId], new Date()),
    );
    await inTransaction(() => outbox(host).markPublished(claimPublication, new Date()));
    const [claimInitialLease] = await inTransaction(() =>
      lifecycle(host).claim({
        publications: claimPublication,
        processingJobId: "claim-first-job",
        processingJobAttempt: 1,
        startedAt: new Date(),
      }),
    );
    if (!claimInitialLease) {
      throw new Error("Expected claim-first initial claim");
    }

    const retryOwnsRows = deferred();
    const releaseRetry = deferred();
    const retryTransaction = inTransaction(async () => {
      const [retry] = await lifecycle(host).claim({
        publications: claimPublication,
        processingJobId: "claim-first-job",
        processingJobAttempt: 2,
        startedAt: new Date(),
      });
      retryOwnsRows.resolve();
      await releaseRetry.promise;
      return retry;
    });
    await waitUntilTransactionHoldsLock(retryOwnsRows, retryTransaction, "retry claim");
    const staleFinalizeStarted = deferred();
    const staleFinalize = trackSettlement(
      inTransaction(async () => {
        staleFinalizeStarted.resolve();
        return lifecycle(host).finalizeSkipped([
          {
            fence: claimInitialLease.fence,
            context: { timezone: "UTC", localDate: new Date("2026-08-29T00:00:00Z") },
            reason: "NO_ACTIVE_TOKEN",
          },
        ]);
      }),
    );
    let finalizeWaitedForRetry = false;
    try {
      await staleFinalizeStarted.promise;
      await waitForBlockedDatabaseQuery(db);
      finalizeWaitedForRetry = !staleFinalize.isSettled();
    } finally {
      releaseRetry.resolve();
    }
    const [retryLease, staleFinalizeCount] = await Promise.all([
      retryTransaction,
      staleFinalize.promise,
    ]);
    expect(finalizeWaitedForRetry).toBe(true);
    expect(retryLease?.fence.deliveryAttemptCount).toBe(
      claimInitialLease.fence.deliveryAttemptCount + 1,
    );
    expect(staleFinalizeCount).toBe(0);
    await expectGeneralOwnershipState(claimFirst.dispatchId, {
      outboxStatus: "PUBLISHED",
      dispatchStatus: "PROCESSING",
    });
  });

  it("publish generation과 worker lease fence가 stale 상태 변경을 거부하고 mode/force를 복원한다", async () => {
    const user = await createUser("FENCE001");
    const staged = await stageNotification({
      userId: user.id,
      suffix: "fenced",
      deliveryMode: "BATCH",
      force: true,
    });
    const claimedOutbox = await inTransaction(() =>
      outbox(host).claimByDispatchIds([staged.dispatchId], new Date(Date.now() + 1_000)),
    );
    expect(claimedOutbox).toEqual([
      { dispatchId: staged.dispatchId, publishAttempt: 1, lane: "TRANSACTIONAL" },
    ]);
    await expect(
      inTransaction(() =>
        outbox(host).markPublished(
          [{ dispatchId: staged.dispatchId, publishAttempt: 99 }],
          new Date(),
        ),
      ),
    ).resolves.toBe(0);
    await expect(
      inTransaction(() => outbox(host).markPublished(claimedOutbox, new Date())),
    ).resolves.toBe(1);

    const claimedDelivery = await inTransaction(() =>
      lifecycle(host).claim({
        publications: claimedOutbox,
        processingJobId: "delivery-job-1",
        processingJobAttempt: 1,
        startedAt: new Date(),
      }),
    );
    expect(claimedDelivery).toHaveLength(1);
    expect(claimedDelivery[0]).toEqual(
      expect.objectContaining({ deliveryMode: "BATCH", force: true }),
    );
    await expect(
      inTransaction(() =>
        lifecycle(host).claim({
          publications: claimedOutbox,
          processingJobId: "duplicate-job",
          processingJobAttempt: 1,
          startedAt: new Date(),
        }),
      ),
    ).resolves.toEqual([]);

    const active = claimedDelivery[0];
    expect(active).toBeDefined();
    if (!active) {
      throw new Error("Expected claimed push delivery");
    }
    await expect(
      inTransaction(() =>
        lifecycle(host).finalizeSkipped([
          {
            fence: active.fence,
            context: {
              timezone: "Asia/Seoul",
              localDate: new Date("2026-08-29T00:00:00Z"),
            },
            reason: "NO_ACTIVE_TOKEN",
          },
        ]),
      ),
    ).resolves.toBe(1);
    await expect(
      inTransaction(() =>
        lifecycle(host).release([
          {
            fence: active.fence,
            error: "stale worker",
            reopenOutbox: false,
            availableAt: new Date("2026-08-29T00:00:00Z"),
          },
        ]),
      ),
    ).resolves.toBe(0);
    await expect(
      db.query.pushDispatch
        .findFirst({ where: { id: staged.dispatchId } })
        .then((row) => requireRecord(row)),
    ).resolves.toEqual(expect.objectContaining({ status: "SKIPPED" }));
  });

  it("같은 runtime job의 높은 attempt만 lease를 재claim하고 dispatch 정책 승인을 새 generation에서도 재사용한다", async () => {
    const user = await createUser("RECLAIM1");
    const staged = await stageNotification({ userId: user.id, suffix: "reclaim" });
    const firstPublication = await inTransaction(() =>
      outbox(host).claimByDispatchIds([staged.dispatchId], new Date()),
    );
    await inTransaction(() => outbox(host).markPublished(firstPublication, new Date()));
    const firstClaim = await inTransaction(() =>
      lifecycle(host).claim({
        publications: firstPublication,
        processingJobId: "stable-runtime-job",
        processingJobAttempt: 1,
        startedAt: new Date(),
      }),
    );
    const first = firstClaim[0];
    if (!first) {
      throw new Error("Expected first delivery claim");
    }
    await expect(
      inTransaction(async () => {
        await lifecycle(host).release([
          {
            fence: first.fence,
            error: "simulated release commit failure",
            reopenOutbox: false,
            availableAt: new Date(),
          },
        ]);
        throw new Error("release transaction rolled back");
      }),
    ).rejects.toThrow("release transaction rolled back");
    await expect(
      db.query.pushDispatch
        .findFirst({ where: { id: staged.dispatchId } })
        .then((row) => requireRecord(row)),
    ).resolves.toEqual(
      expect.objectContaining({
        status: "PROCESSING",
        processingJobId: "stable-runtime-job",
        processingJobAttempt: 1,
      }),
    );

    await expect(
      inTransaction(() =>
        lifecycle(host).claim({
          publications: firstPublication,
          processingJobId: "different-runtime-job",
          processingJobAttempt: 2,
          startedAt: new Date(),
        }),
      ),
    ).resolves.toEqual([]);
    const retryClaim = await inTransaction(() =>
      lifecycle(host).claim({
        publications: firstPublication,
        processingJobId: "stable-runtime-job",
        processingJobAttempt: 2,
        startedAt: new Date(),
      }),
    );
    const retry = retryClaim[0];
    if (!retry) {
      throw new Error("Expected same-job retry claim");
    }
    expect(retry.fence.deliveryAttemptCount).toBe(first.fence.deliveryAttemptCount + 1);
    await expect(
      inTransaction(() =>
        lifecycle(host).finalizeSkipped([
          {
            fence: first.fence,
            context: {
              timezone: "Asia/Seoul",
              localDate: new Date("2026-08-29T00:00:00Z"),
            },
            reason: "NO_ACTIVE_TOKEN",
          },
        ]),
      ),
    ).resolves.toBe(0);

    await expect(
      inTransaction(() =>
        lifecycle(host).markRateLimitReserved([{ fence: retry.fence, reservedAt: new Date() }]),
      ),
    ).resolves.toEqual([staged.dispatchId]);
    await expect(
      inTransaction(() =>
        lifecycle(host).release([
          {
            fence: retry.fence,
            error: "runtime retries exhausted",
            reopenOutbox: true,
            availableAt: new Date(0),
          },
        ]),
      ),
    ).resolves.toBe(1);
    await expect(
      db.query.pushDispatchOutbox
        .findFirst({ where: { dispatchId: staged.dispatchId } })
        .then((row) => requireRecord(row)),
    ).resolves.toEqual(expect.objectContaining({ status: "PENDING", publishAttempts: 1 }));

    const secondPublication = await inTransaction(() =>
      outbox(host).claimAvailable({ limit: 1, lockedAt: new Date() }),
    );
    expect(secondPublication).toEqual([
      { dispatchId: staged.dispatchId, publishAttempt: 2, lane: "TRANSACTIONAL" },
    ]);
    const nextGenerationClaim = await inTransaction(() =>
      lifecycle(host).claim({
        publications: secondPublication,
        processingJobId: "next-generation-job",
        processingJobAttempt: 1,
        startedAt: new Date(),
      }),
    );
    expect(nextGenerationClaim[0]?.rateLimitReservation).toEqual({ status: "reserved" });
  });

  it("release DB 실패로 남은 stale delivery lease는 dispatch와 일반 outbox를 함께 reopen한다", async () => {
    const user = await createUser("STALE001");
    const staged = await stageNotification({ userId: user.id, suffix: "stale" });
    const publication = await inTransaction(() =>
      outbox(host).claimByDispatchIds([staged.dispatchId], new Date("2026-08-29T00:00:00Z")),
    );
    await inTransaction(() =>
      outbox(host).markPublished(publication, new Date("2026-08-29T00:00:01Z")),
    );
    await inTransaction(() =>
      lifecycle(host).claim({
        publications: publication,
        processingJobId: "final-attempt-release-failed",
        processingJobAttempt: 6,
        startedAt: new Date("2026-08-29T00:00:02Z"),
      }),
    );

    await expect(
      inTransaction(() => lifecycle(host).recoverStaleProcessing(new Date("2026-08-29T00:15:03Z"))),
    ).resolves.toBe(1);
    await expect(
      db.query.pushDispatch
        .findFirst({ where: { id: staged.dispatchId } })
        .then((row) => requireRecord(row)),
    ).resolves.toEqual(expect.objectContaining({ status: "PENDING", processingJobId: null }));
    await expect(
      db.query.pushDispatchOutbox
        .findFirst({ where: { dispatchId: staged.dispatchId } })
        .then((row) => requireRecord(row)),
    ).resolves.toEqual(expect.objectContaining({ status: "PENDING", publishAttempts: 1 }));
    await expect(
      inTransaction(() =>
        outbox(host).claimAvailable({ limit: 1, lockedAt: new Date("2026-08-29T00:15:04Z") }),
      ),
    ).resolves.toEqual([
      { dispatchId: staged.dispatchId, publishAttempt: 2, lane: "TRANSACTIONAL" },
    ]);
  });

  it("final claim recovery는 matching PENDING generation만 CAS하고 partial exact recovery를 rollback한다", async () => {
    const user = await createUser("CLAIMREC");
    const first = await stageNotification({ userId: user.id, suffix: "claim-first" });
    const terminal = await stageNotification({ userId: user.id, suffix: "claim-terminal" });
    const publications = await inTransaction(() =>
      outbox(host).claimByDispatchIds(
        [first.dispatchId, terminal.dispatchId],
        new Date("2026-08-29T00:00:00Z"),
      ),
    );
    await inTransaction(() =>
      outbox(host).markPublished(publications, new Date("2026-08-29T00:00:01Z")),
    );
    await db
      .update(pushDispatch)
      .set({ status: "SENT", sentAt: new Date() })
      .where(eq(pushDispatch.id, terminal.dispatchId));

    await expect(
      inTransaction(async () => {
        const recovered = await lifecycle(host).reopenAfterFinalClaimFailure({
          publications,
          availableAt: new Date(),
          error: "claim unavailable",
        });
        if (recovered !== publications.length) {
          throw new Error("partial recovery");
        }
      }),
    ).rejects.toThrow("partial recovery");
    await expect(
      db.$count(pushDispatchOutbox, eq(pushDispatchOutbox.status, "PUBLISHED")),
    ).resolves.toBe(2);

    await expect(
      inTransaction(() =>
        lifecycle(host).reopenFailedPublications({
          publications,
          availableAt: new Date(),
          error: "dead-letter recovery",
        }),
      ),
    ).resolves.toBe(1);
    await expect(
      inTransaction(() =>
        lifecycle(host).reopenFailedPublications({
          publications: [{ dispatchId: terminal.dispatchId, publishAttempt: 999 }],
          availableAt: new Date(),
          error: "stale generation",
        }),
      ),
    ).resolves.toBe(0);
  });

  it("processing lease partial index가 migration 결과에 존재한다", async () => {
    async function indexNames(tableName: string) {
      const { rows } = await db.execute<{ indexName: string }>(sql`
        SELECT indexname AS "indexName"
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = ${tableName}
      `);
      return rows.map((row) => row.indexName);
    }

    const indexes = await indexNames("PushDispatch");
    expect(indexes).toContain("PushDispatch_processing_lease_idx");
    const outboxIndexes = await indexNames("PushDispatchOutbox");
    expect(outboxIndexes).toContain("PushDispatchOutbox_status_availableAt_dispatchId_idx");
    expect(outboxIndexes).not.toContain("PushDispatchOutbox_status_publishedAt_idx");
  });
});
