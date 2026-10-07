import { TransactionHost } from "@nestjs-cls/transactional";
import { and } from "@prisma/orm-postgres/orm-client";
import sql from "sql-template-tag";
import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { PrismaPushDeliveryLifecycleRepository } from "#api/notification/infrastructure/persistence/prisma-push-delivery-lifecycle.repository";
import { PrismaPushDeliveryOutboxRepository } from "#api/notification/infrastructure/persistence/prisma-push-delivery-outbox.repository";
import { PrismaPushDispatchStagingRepository } from "#api/notification/infrastructure/persistence/prisma-push-dispatch-staging.repository";
import { PrismaRetentionRepository } from "#api/retention/infrastructure/persistence/prisma-retention.repository";
import {
  decodeRecord,
  encodeCreate,
  encodePatch,
} from "#api/shared/infrastructure/database/database-records";
import {
  decodeSqlRows,
  sqlRowSpec,
  sqlStatement,
} from "#api/shared/infrastructure/database/database-sql";
import { requireRecord } from "#api/shared/infrastructure/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/shared/infrastructure/database/prisma8-transactional.adapter";
import type { Prisma8Transaction } from "#api/shared/infrastructure/database/prisma8-transactional.adapter";
import {
  createDatabaseContext,
  createDatabaseTransactionFixture,
  withDatabaseTransaction,
} from "#test/setup/database-context";
import type { TestDatabaseClient } from "#test/setup/test-database";
import { TestDatabase } from "#test/setup/test-database";

type TransactionClient = Prisma8Transaction;

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

async function waitForBlockedDatabaseQuery(prisma: TestDatabaseClient): Promise<void> {
  await vi.waitFor(
    async () => {
      const sqlRows1 = sqlRowSpec({ blocked: "pg/bool@1" });

      const waiting = decodeSqlRows(
        sqlRows1,
        await prisma.runtime().query(
          sqlStatement(
            prisma,
            sql`
			SELECT EXISTS (
				SELECT 1 FROM pg_stat_activity
				WHERE datname = current_database() AND wait_event_type = 'Lock'
			) AS blocked
		`,
          )
            .returnsRow(sqlRows1)
            .build(),
        ),
      );
      expect(waiting[0]?.blocked).toBe(true);
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

function transactionHost(
  client: TestDatabaseClient | TransactionClient,
): TransactionHost<Prisma8TransactionalAdapter> {
  const host = mock<TransactionHost<Prisma8TransactionalAdapter>>();
  Object.defineProperty(host, "tx", {
    value: "runtime" in client ? createDatabaseContext(client) : client,
  });
  return host;
}

function staging(
  client: TestDatabaseClient | TransactionClient,
): PrismaPushDispatchStagingRepository {
  return new PrismaPushDispatchStagingRepository(transactionHost(client));
}

function outbox(
  client: TestDatabaseClient | TransactionClient,
): PrismaPushDeliveryOutboxRepository {
  return new PrismaPushDeliveryOutboxRepository(transactionHost(client));
}

function lifecycle(
  client: TestDatabaseClient | TransactionClient,
): PrismaPushDeliveryLifecycleRepository {
  return new PrismaPushDeliveryLifecycleRepository(transactionHost(client));
}

function retention(client: TestDatabaseClient | TransactionClient): PrismaRetentionRepository {
  const { txHost, uow } = createDatabaseTransactionFixture(client);
  return new PrismaRetentionRepository(txHost, uow);
}

describe("일반 push delivery outbox (실제 PostgreSQL)", () => {
  let testDatabase: TestDatabase;
  let prisma: TestDatabaseClient;

  beforeAll(async () => {
    testDatabase = new TestDatabase();
    prisma = await testDatabase.start();
  });

  afterAll(async () => {
    await testDatabase?.stop();
  });

  beforeEach(async () => {
    await testDatabase.cleanup();
  });

  async function createUser(suffix: string): Promise<{ id: string }> {
    return prisma.orm.public.User.select("id")
      .create(
        encodeCreate("User", {
          email: `push-outbox-${suffix}@example.com`,
          userTag: suffix.padEnd(8, "X").slice(0, 8),
          status: "ACTIVE",
        }),
      )
      .then((row) => decodeRecord("User", row));
  }

  async function createNotification(userId: string, suffix: string) {
    return prisma.orm.public.Notification.create(
      encodeCreate("Notification", {
        userId,
        type: "SYSTEM_NOTICE",
        title: `title-${suffix}`,
        body: `body-${suffix}`,
      }),
    ).then((row) => decodeRecord("Notification", row));
  }

  async function stageNotification(input: {
    readonly userId: string;
    readonly suffix: string;
    readonly deliveryMode?: "SINGLE" | "BATCH";
    readonly force?: boolean;
  }) {
    const notification = await createNotification(input.userId, input.suffix);
    return staging(prisma).stage({
      notificationId: notification.id,
      userId: input.userId,
      purpose: "TRANSACTIONAL",
      deliveryMode: input.deliveryMode ?? "SINGLE",
      force: input.force ?? false,
    });
  }

  async function stageRetentionPublication(input: {
    readonly userTag: string;
    readonly lockedAt: Date;
  }) {
    const user = await createUser(input.userTag);
    await retention(prisma).enroll({
      userId: user.id,
      variant: "TREATMENT",
      startedAt: new Date("2026-07-01T00:00:00.000Z"),
    });
    const stage = decodeRecord(
      "RetentionExperimentStage",
      requireRecord(
        await prisma.orm.public.RetentionExperimentStage.where((row) =>
          and(
            row.assignment.some((related) => related.userId.eq(user.id)),
            row.stage.eq("D1"),
          ),
        ).first(),
      ),
    );
    const created = await retention(prisma).createDelivery({
      stageId: stage.id,
      userId: user.id,
      timezone: "UTC",
      title: `title-${input.userTag}`,
      body: `body-${input.userTag}`,
      route: "/feed",
      variantId: "d1_return",
    });
    if (!created) throw new Error("Expected retention delivery to be staged");
    const pendingOutbox = decodeRecord(
      "RetentionPushOutbox",
      requireRecord(
        await prisma.orm.public.RetentionPushOutbox.where((row) =>
          row.stageId.eq(stage.id),
        ).first(),
      ),
    );
    const claimedOutbox = decodeRecord(
      "RetentionPushOutbox",
      requireRecord(
        await prisma.orm.public.RetentionPushOutbox.where((row) =>
          row.id.eq(pendingOutbox.id),
        ).update(
          encodePatch("RetentionPushOutbox", {
            status: "PROCESSING",
            attempts: 1,
            lockedAt: input.lockedAt,
          }),
        ),
      ),
    );
    return {
      outboxId: claimedOutbox.id,
      dispatchId: claimedOutbox.dispatchId,
      publishAttempt: claimedOutbox.attempts,
    };
  }

  async function expectGeneralOwnershipState(
    dispatchId: number,
    expected: {
      readonly outboxStatus: "PENDING" | "PROCESSING" | "PUBLISHED";
      readonly dispatchStatus: "PENDING" | "PROCESSING" | "SKIPPED";
    },
  ): Promise<void> {
    const [dispatch, dispatchOutbox] = await Promise.all([
      prisma.orm.public.PushDispatch.where((row) => row.id.eq(dispatchId))
        .first()
        .then((row) => decodeRecord("PushDispatch", requireRecord(row))),
      prisma.orm.public.PushDispatchOutbox.where((row) => row.dispatchId.eq(dispatchId))
        .first()
        .then((row) => decodeRecord("PushDispatchOutbox", requireRecord(row))),
    ]);
    expect({ outboxStatus: dispatchOutbox.status, dispatchStatus: dispatch.status }).toEqual(
      expected,
    );
    expect(dispatchOutbox.status === "PENDING" && dispatch.status === "PROCESSING").toBe(false);
  }

  async function expectRetentionOwnershipState(
    input: { readonly outboxId: string; readonly dispatchId: number },
    expected: {
      readonly outboxStatus: "PENDING" | "PROCESSING" | "PUBLISHED";
      readonly dispatchStatus: "PENDING" | "PROCESSING" | "SKIPPED";
    },
  ): Promise<void> {
    const [dispatch, retentionOutbox] = await Promise.all([
      prisma.orm.public.PushDispatch.where((row) => row.id.eq(input.dispatchId))
        .first()
        .then((row) => decodeRecord("PushDispatch", requireRecord(row))),
      prisma.orm.public.RetentionPushOutbox.where((row) => row.id.eq(input.outboxId))
        .first()
        .then((row) => decodeRecord("RetentionPushOutbox", requireRecord(row))),
    ]);
    expect({ outboxStatus: retentionOutbox.status, dispatchStatus: dispatch.status }).toEqual(
      expected,
    );
    expect(retentionOutbox.status === "PENDING" && dispatch.status === "PROCESSING").toBe(false);
  }

  it("notification, dispatch, outbox를 함께 commit하고 실패 시 모두 rollback한다", async () => {
    const committedUser = await createUser("COMMIT01");
    await withDatabaseTransaction(prisma, async (tx) => {
      const notification = decodeRecord(
        "Notification",
        await tx.orm.public.Notification.create(
          encodeCreate("Notification", {
            userId: committedUser.id,
            type: "SYSTEM_NOTICE",
            title: "committed",
            body: "committed",
          }),
        ),
      );
      await staging(tx).stage({
        notificationId: notification.id,
        userId: committedUser.id,
        purpose: "TRANSACTIONAL",
        deliveryMode: "SINGLE",
        force: false,
      });
    });

    await expect(
      prisma.orm.public.Notification.where((row) => row.userId.eq(committedUser.id))
        .aggregate((aggregate) => ({ count: aggregate.count() }))
        .then(({ count }) => count),
    ).resolves.toBe(1);
    await expect(
      prisma.orm.public.PushDispatch.where((row) => row.userId.eq(committedUser.id))
        .aggregate((aggregate) => ({ count: aggregate.count() }))
        .then(({ count }) => count),
    ).resolves.toBe(1);
    await expect(
      prisma.orm.public.PushDispatchOutbox.aggregate((aggregate) => ({
        count: aggregate.count(),
      })).then(({ count }) => count),
    ).resolves.toBe(1);

    const rolledBackUser = await createUser("ROLLBACK");
    await expect(
      withDatabaseTransaction(prisma, async (tx) => {
        const notification = decodeRecord(
          "Notification",
          await tx.orm.public.Notification.create(
            encodeCreate("Notification", {
              userId: rolledBackUser.id,
              type: "SYSTEM_NOTICE",
              title: "rolled-back",
              body: "rolled-back",
            }),
          ),
        );
        await staging(tx).stage({
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
      prisma.orm.public.Notification.where((row) => row.userId.eq(rolledBackUser.id))
        .aggregate((aggregate) => ({ count: aggregate.count() }))
        .then(({ count }) => count),
    ).resolves.toBe(0);
    await expect(
      prisma.orm.public.PushDispatch.where((row) => row.userId.eq(rolledBackUser.id))
        .aggregate((aggregate) => ({ count: aggregate.count() }))
        .then(({ count }) => count),
    ).resolves.toBe(0);
    await expect(
      prisma.orm.public.PushDispatchOutbox.aggregate((aggregate) => ({
        count: aggregate.count(),
      })).then(({ count }) => count),
    ).resolves.toBe(1);
  });

  it("동시 relay claim은 SKIP LOCKED로 같은 outbox를 중복 소유하지 않는다", async () => {
    const user = await createUser("LOCKED01");
    const first = await stageNotification({ userId: user.id, suffix: "first" });
    const second = await stageNotification({ userId: user.id, suffix: "second" });
    const firstClaimed = deferred();
    const releaseFirst = deferred();
    const lockedAt = new Date(Date.now() + 1_000);

    const firstTransaction = withDatabaseTransaction(prisma, async (tx) => {
      const claimed = await outbox(tx).claimAvailable({ limit: 1, lockedAt });
      firstClaimed.resolve();
      await releaseFirst.promise;
      return claimed;
    });
    await firstClaimed.promise;
    const secondClaim = await withDatabaseTransaction(prisma, (tx) =>
      outbox(tx).claimAvailable({ limit: 2, lockedAt }),
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
    const publication = await withDatabaseTransaction(prisma, (tx) =>
      outbox(tx).claimByDispatchIds([staged.dispatchId], staleLockedAt),
    );
    const claimOwnsRows = deferred();
    const releaseClaim = deferred();
    const claimTransaction = withDatabaseTransaction(prisma, async (tx) => {
      const claimed = await lifecycle(tx).claim({
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
      recovered = await withDatabaseTransaction(prisma, (tx) =>
        outbox(tx).recoverStaleProcessing(new Date("2026-08-29T00:15:00.000Z")),
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
    const publication = await withDatabaseTransaction(prisma, (tx) =>
      outbox(tx).claimByDispatchIds([staged.dispatchId], new Date("2026-08-29T00:00:00.000Z")),
    );
    const recoveryOwnsOutbox = deferred();
    const releaseRecovery = deferred();
    const recoveryTransaction = withDatabaseTransaction(prisma, async (tx) => {
      const recovered = await outbox(tx).recoverStaleProcessing(
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
      withDatabaseTransaction(prisma, async (tx) => {
        claimStarted.resolve();
        return lifecycle(tx).claim({
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
      await waitForBlockedDatabaseQuery(prisma);
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
    const publication = await withDatabaseTransaction(prisma, (tx) =>
      outbox(tx).claimByDispatchIds([staged.dispatchId], new Date()),
    );
    const claimOwnsRows = deferred();
    const releaseClaim = deferred();
    const claimTransaction = withDatabaseTransaction(prisma, async (tx) => {
      const claimed = await lifecycle(tx).claim({
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
      withDatabaseTransaction(prisma, async (tx) => {
        deferStarted.resolve();
        return outbox(tx).defer({
          publications: publication,
          availableAt: new Date(Date.now() + 60_000),
          error: "ambiguous enqueue result",
        });
      }),
    );
    let deferWaitedForClaim = false;
    try {
      await deferStarted.promise;
      await waitForBlockedDatabaseQuery(prisma);
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
    const publication = await withDatabaseTransaction(prisma, (tx) =>
      outbox(tx).claimByDispatchIds([staged.dispatchId], new Date()),
    );
    const deferOwnsOutbox = deferred();
    const releaseDefer = deferred();
    const deferTransaction = withDatabaseTransaction(prisma, async (tx) => {
      const deferredCount = await outbox(tx).defer({
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
      withDatabaseTransaction(prisma, async (tx) => {
        claimStarted.resolve();
        return lifecycle(tx).claim({
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
      await waitForBlockedDatabaseQuery(prisma);
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
    const terminalPublication = await withDatabaseTransaction(prisma, (tx) =>
      outbox(tx).claimByDispatchIds([terminalFirst.dispatchId], new Date()),
    );
    await withDatabaseTransaction(prisma, (tx) =>
      outbox(tx).markPublished(terminalPublication, new Date()),
    );
    const [terminalInitialClaim] = await withDatabaseTransaction(prisma, (tx) =>
      lifecycle(tx).claim({
        publications: terminalPublication,
        processingJobId: "terminal-first-job",
        processingJobAttempt: 1,
        startedAt: new Date(),
      }),
    );
    if (!terminalInitialClaim) throw new Error("Expected terminal-first initial claim");

    const terminalOwnsRows = deferred();
    const releaseTerminal = deferred();
    const terminalTransaction = withDatabaseTransaction(prisma, async (tx) => {
      const finalized = await lifecycle(tx).finalizeSkipped([
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
      withDatabaseTransaction(prisma, async (tx) => {
        terminalRetryStarted.resolve();
        return lifecycle(tx).claim({
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
      await waitForBlockedDatabaseQuery(prisma);
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
    const claimPublication = await withDatabaseTransaction(prisma, (tx) =>
      outbox(tx).claimByDispatchIds([claimFirst.dispatchId], new Date()),
    );
    await withDatabaseTransaction(prisma, (tx) =>
      outbox(tx).markPublished(claimPublication, new Date()),
    );
    const [claimInitialLease] = await withDatabaseTransaction(prisma, (tx) =>
      lifecycle(tx).claim({
        publications: claimPublication,
        processingJobId: "claim-first-job",
        processingJobAttempt: 1,
        startedAt: new Date(),
      }),
    );
    if (!claimInitialLease) throw new Error("Expected claim-first initial claim");

    const retryOwnsRows = deferred();
    const releaseRetry = deferred();
    const retryTransaction = withDatabaseTransaction(prisma, async (tx) => {
      const [retry] = await lifecycle(tx).claim({
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
      withDatabaseTransaction(prisma, async (tx) => {
        staleFinalizeStarted.resolve();
        return lifecycle(tx).finalizeSkipped([
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
      await waitForBlockedDatabaseQuery(prisma);
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
    const claimedOutbox = await withDatabaseTransaction(prisma, (tx) =>
      outbox(tx).claimByDispatchIds([staged.dispatchId], new Date(Date.now() + 1_000)),
    );
    expect(claimedOutbox).toEqual([{ dispatchId: staged.dispatchId, publishAttempt: 1 }]);
    await expect(
      withDatabaseTransaction(prisma, (tx) =>
        outbox(tx).markPublished(
          [{ dispatchId: staged.dispatchId, publishAttempt: 99 }],
          new Date(),
        ),
      ),
    ).resolves.toBe(0);
    await expect(
      withDatabaseTransaction(prisma, (tx) => outbox(tx).markPublished(claimedOutbox, new Date())),
    ).resolves.toBe(1);

    const claimedDelivery = await withDatabaseTransaction(prisma, (tx) =>
      lifecycle(tx).claim({
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
      withDatabaseTransaction(prisma, (tx) =>
        lifecycle(tx).claim({
          publications: claimedOutbox,
          processingJobId: "duplicate-job",
          processingJobAttempt: 1,
          startedAt: new Date(),
        }),
      ),
    ).resolves.toEqual([]);

    const active = claimedDelivery[0];
    expect(active).toBeDefined();
    if (!active) throw new Error("Expected claimed push delivery");
    await expect(
      withDatabaseTransaction(prisma, (tx) =>
        lifecycle(tx).finalizeSkipped([
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
      withDatabaseTransaction(prisma, (tx) =>
        lifecycle(tx).release([
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
      prisma.orm.public.PushDispatch.where((row) => row.id.eq(staged.dispatchId))
        .first()
        .then((row) => decodeRecord("PushDispatch", requireRecord(row))),
    ).resolves.toEqual(expect.objectContaining({ status: "SKIPPED" }));
  });

  it("같은 runtime job의 높은 attempt만 lease를 재claim하고 dispatch 정책 승인을 새 generation에서도 재사용한다", async () => {
    const user = await createUser("RECLAIM1");
    const staged = await stageNotification({ userId: user.id, suffix: "reclaim" });
    const firstPublication = await withDatabaseTransaction(prisma, (tx) =>
      outbox(tx).claimByDispatchIds([staged.dispatchId], new Date()),
    );
    await withDatabaseTransaction(prisma, (tx) =>
      outbox(tx).markPublished(firstPublication, new Date()),
    );
    const firstClaim = await withDatabaseTransaction(prisma, (tx) =>
      lifecycle(tx).claim({
        publications: firstPublication,
        processingJobId: "stable-runtime-job",
        processingJobAttempt: 1,
        startedAt: new Date(),
      }),
    );
    const first = firstClaim[0];
    if (!first) throw new Error("Expected first delivery claim");
    await expect(
      withDatabaseTransaction(prisma, async (tx) => {
        await lifecycle(tx).release([
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
      prisma.orm.public.PushDispatch.where((row) => row.id.eq(staged.dispatchId))
        .first()
        .then((row) => decodeRecord("PushDispatch", requireRecord(row))),
    ).resolves.toEqual(
      expect.objectContaining({
        status: "PROCESSING",
        processingJobId: "stable-runtime-job",
        processingJobAttempt: 1,
      }),
    );

    await expect(
      withDatabaseTransaction(prisma, (tx) =>
        lifecycle(tx).claim({
          publications: firstPublication,
          processingJobId: "different-runtime-job",
          processingJobAttempt: 2,
          startedAt: new Date(),
        }),
      ),
    ).resolves.toEqual([]);
    const retryClaim = await withDatabaseTransaction(prisma, (tx) =>
      lifecycle(tx).claim({
        publications: firstPublication,
        processingJobId: "stable-runtime-job",
        processingJobAttempt: 2,
        startedAt: new Date(),
      }),
    );
    const retry = retryClaim[0];
    if (!retry) throw new Error("Expected same-job retry claim");
    expect(retry.fence.deliveryAttemptCount).toBe(first.fence.deliveryAttemptCount + 1);
    await expect(
      withDatabaseTransaction(prisma, (tx) =>
        lifecycle(tx).finalizeSkipped([
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
      withDatabaseTransaction(prisma, (tx) =>
        lifecycle(tx).markRateLimitReserved([{ fence: retry.fence, reservedAt: new Date() }]),
      ),
    ).resolves.toEqual([staged.dispatchId]);
    await expect(
      withDatabaseTransaction(prisma, (tx) =>
        lifecycle(tx).release([
          {
            fence: retry.fence,
            error: "runtime retries exhausted",
            reopenOutbox: true,
            // 이 테스트는 backoff 계산이 아니라 다음 publication generation의
            // 재사용을 검증한다. DB clock과 app clock의 sub-ms 차이에 의존하지
            // 않도록 명시적으로 이미 due인 시각을 사용한다.
            availableAt: new Date(0),
          },
        ]),
      ),
    ).resolves.toBe(1);
    await expect(
      prisma.orm.public.PushDispatchOutbox.where((row) => row.dispatchId.eq(staged.dispatchId))
        .first()
        .then((row) => decodeRecord("PushDispatchOutbox", requireRecord(row))),
    ).resolves.toEqual(expect.objectContaining({ status: "PENDING", publishAttempts: 1 }));

    const secondPublication = await withDatabaseTransaction(prisma, (tx) =>
      outbox(tx).claimAvailable({ limit: 1, lockedAt: new Date() }),
    );
    expect(secondPublication).toEqual([{ dispatchId: staged.dispatchId, publishAttempt: 2 }]);
    const nextGenerationClaim = await withDatabaseTransaction(prisma, (tx) =>
      lifecycle(tx).claim({
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
    const publication = await withDatabaseTransaction(prisma, (tx) =>
      outbox(tx).claimByDispatchIds([staged.dispatchId], new Date("2026-08-29T00:00:00Z")),
    );
    await withDatabaseTransaction(prisma, (tx) =>
      outbox(tx).markPublished(publication, new Date("2026-08-29T00:00:01Z")),
    );
    await withDatabaseTransaction(prisma, (tx) =>
      lifecycle(tx).claim({
        publications: publication,
        processingJobId: "final-attempt-release-failed",
        processingJobAttempt: 6,
        startedAt: new Date("2026-08-29T00:00:02Z"),
      }),
    );

    await expect(
      withDatabaseTransaction(prisma, (tx) =>
        lifecycle(tx).recoverStaleProcessing(new Date("2026-08-29T00:15:03Z")),
      ),
    ).resolves.toBe(1);
    await expect(
      prisma.orm.public.PushDispatch.where((row) => row.id.eq(staged.dispatchId))
        .first()
        .then((row) => decodeRecord("PushDispatch", requireRecord(row))),
    ).resolves.toEqual(expect.objectContaining({ status: "PENDING", processingJobId: null }));
    await expect(
      prisma.orm.public.PushDispatchOutbox.where((row) => row.dispatchId.eq(staged.dispatchId))
        .first()
        .then((row) => decodeRecord("PushDispatchOutbox", requireRecord(row))),
    ).resolves.toEqual(expect.objectContaining({ status: "PENDING", publishAttempts: 1 }));
    await expect(
      withDatabaseTransaction(prisma, (tx) =>
        outbox(tx).claimAvailable({ limit: 1, lockedAt: new Date("2026-08-29T00:15:04Z") }),
      ),
    ).resolves.toEqual([{ dispatchId: staged.dispatchId, publishAttempt: 2 }]);
  });

  it("retention worker claim이 outbox lock을 먼저 잡으면 stale recovery는 해당 generation을 건너뛴다", async () => {
    const publication = await stageRetentionPublication({
      userTag: "RETCLM01",
      lockedAt: new Date("2026-08-29T00:00:00.000Z"),
    });
    const claimOwnsRows = deferred();
    const releaseClaim = deferred();
    const claimTransaction = withDatabaseTransaction(prisma, async (tx) => {
      const claimed = await retention(tx).claimDispatch({
        outboxId: publication.outboxId,
        publishAttempt: publication.publishAttempt,
        processingJobId: "retention-claim-first",
        processingJobAttempt: 1,
        startedAt: new Date("2026-08-29T00:20:00.000Z"),
      });
      claimOwnsRows.resolve();
      await releaseClaim.promise;
      return claimed;
    });

    let recovered = -1;
    try {
      await waitUntilTransactionHoldsLock(claimOwnsRows, claimTransaction, "retention claim");
      recovered = await withDatabaseTransaction(prisma, (tx) =>
        retention(tx).recoverStaleOutboxes(new Date("2026-08-29T00:15:00.000Z")),
      );
    } finally {
      releaseClaim.resolve();
    }
    const claimed = await claimTransaction;

    expect(recovered).toBe(0);
    expect(claimed).not.toBeNull();
    await expectRetentionOwnershipState(publication, {
      outboxStatus: "PUBLISHED",
      dispatchStatus: "PROCESSING",
    });
  });

  it("retention stale recovery가 outbox lock을 먼저 잡으면 worker claim은 복구된 generation을 소유하지 않는다", async () => {
    const publication = await stageRetentionPublication({
      userTag: "RETRCV01",
      lockedAt: new Date("2026-08-29T00:00:00.000Z"),
    });
    const recoveryOwnsOutbox = deferred();
    const releaseRecovery = deferred();
    const recoveryTransaction = withDatabaseTransaction(prisma, async (tx) => {
      const recovered = await retention(tx).recoverStaleOutboxes(
        new Date("2026-08-29T00:15:00.000Z"),
      );
      recoveryOwnsOutbox.resolve();
      await releaseRecovery.promise;
      return recovered;
    });

    await waitUntilTransactionHoldsLock(
      recoveryOwnsOutbox,
      recoveryTransaction,
      "retention recovery",
    );
    const claimStarted = deferred();
    const trackedClaim = trackSettlement(
      withDatabaseTransaction(prisma, async (tx) => {
        claimStarted.resolve();
        return retention(tx).claimDispatch({
          outboxId: publication.outboxId,
          publishAttempt: publication.publishAttempt,
          processingJobId: "retention-recovery-first",
          processingJobAttempt: 1,
          startedAt: new Date("2026-08-29T00:20:00.000Z"),
        });
      }),
    );
    let claimWaitedForRecovery = false;
    try {
      await claimStarted.promise;
      await waitForBlockedDatabaseQuery(prisma);
      claimWaitedForRecovery = !trackedClaim.isSettled();
    } finally {
      releaseRecovery.resolve();
    }
    const [recovered, claimed] = await Promise.all([recoveryTransaction, trackedClaim.promise]);

    expect(claimWaitedForRecovery).toBe(true);
    expect(recovered).toBe(1);
    expect(claimed).toBeNull();
    await expectRetentionOwnershipState(publication, {
      outboxStatus: "PENDING",
      dispatchStatus: "PENDING",
    });
  });

  it("retention worker claim이 먼저 commit되면 늦게 도착한 enqueue defer는 소유권을 되돌리지 않는다", async () => {
    const publication = await stageRetentionPublication({
      userTag: "RETDEF01",
      lockedAt: new Date(),
    });
    const claimOwnsRows = deferred();
    const releaseClaim = deferred();
    const claimTransaction = withDatabaseTransaction(prisma, async (tx) => {
      const claimed = await retention(tx).claimDispatch({
        outboxId: publication.outboxId,
        publishAttempt: publication.publishAttempt,
        processingJobId: "retention-claim-before-defer",
        processingJobAttempt: 1,
        startedAt: new Date(),
      });
      claimOwnsRows.resolve();
      await releaseClaim.promise;
      return claimed;
    });

    await waitUntilTransactionHoldsLock(claimOwnsRows, claimTransaction, "retention claim");
    const deferStarted = deferred();
    const trackedDefer = trackSettlement(
      withDatabaseTransaction(prisma, async (tx) => {
        deferStarted.resolve();
        return retention(tx).deferOutbox({
          outboxId: publication.outboxId,
          publishAttempt: publication.publishAttempt,
          availableAt: new Date(Date.now() + 60_000),
        });
      }),
    );
    let deferWaitedForClaim = false;
    try {
      await deferStarted.promise;
      await waitForBlockedDatabaseQuery(prisma);
      deferWaitedForClaim = !trackedDefer.isSettled();
    } finally {
      releaseClaim.resolve();
    }
    const [claimed] = await Promise.all([claimTransaction, trackedDefer.promise]);

    expect(deferWaitedForClaim).toBe(true);
    expect(claimed).not.toBeNull();
    await expectRetentionOwnershipState(publication, {
      outboxStatus: "PUBLISHED",
      dispatchStatus: "PROCESSING",
    });
  });

  it("retention enqueue defer가 먼저 commit되면 worker claim은 되돌려진 generation을 소유하지 않는다", async () => {
    const publication = await stageRetentionPublication({
      userTag: "RETDEF02",
      lockedAt: new Date(),
    });
    const deferOwnsOutbox = deferred();
    const releaseDefer = deferred();
    const deferTransaction = withDatabaseTransaction(prisma, async (tx) => {
      await retention(tx).deferOutbox({
        outboxId: publication.outboxId,
        publishAttempt: publication.publishAttempt,
        availableAt: new Date(Date.now() + 60_000),
      });
      deferOwnsOutbox.resolve();
      await releaseDefer.promise;
    });

    await waitUntilTransactionHoldsLock(deferOwnsOutbox, deferTransaction, "retention defer");
    const claimStarted = deferred();
    const trackedClaim = trackSettlement(
      withDatabaseTransaction(prisma, async (tx) => {
        claimStarted.resolve();
        return retention(tx).claimDispatch({
          outboxId: publication.outboxId,
          publishAttempt: publication.publishAttempt,
          processingJobId: "retention-defer-before-claim",
          processingJobAttempt: 1,
          startedAt: new Date(),
        });
      }),
    );
    let claimWaitedForDefer = false;
    try {
      await claimStarted.promise;
      await waitForBlockedDatabaseQuery(prisma);
      claimWaitedForDefer = !trackedClaim.isSettled();
    } finally {
      releaseDefer.resolve();
    }
    const [, claimed] = await Promise.all([deferTransaction, trackedClaim.promise]);

    expect(claimWaitedForDefer).toBe(true);
    expect(claimed).toBeNull();
    await expectRetentionOwnershipState(publication, {
      outboxStatus: "PENDING",
      dispatchStatus: "PENDING",
    });
  });

  it("retention terminal finalize와 same-job retry claim도 outbox부터 직렬화한다", async () => {
    const terminalFirst = await stageRetentionPublication({
      userTag: "RTTERM01",
      lockedAt: new Date(),
    });
    const terminalInitialClaim = await withDatabaseTransaction(prisma, (tx) =>
      retention(tx).claimDispatch({
        outboxId: terminalFirst.outboxId,
        publishAttempt: terminalFirst.publishAttempt,
        processingJobId: "retention-terminal-first",
        processingJobAttempt: 1,
        startedAt: new Date(),
      }),
    );
    if (!terminalInitialClaim) throw new Error("Expected retention terminal-first claim");

    const terminalOwnsRows = deferred();
    const releaseTerminal = deferred();
    const terminalTransaction = withDatabaseTransaction(prisma, async (tx) => {
      const finalized = await retention(tx).markDispatchSkipped(
        terminalInitialClaim.fence,
        "NO_ACTIVE_TOKEN",
      );
      terminalOwnsRows.resolve();
      await releaseTerminal.promise;
      return finalized;
    });
    await waitUntilTransactionHoldsLock(
      terminalOwnsRows,
      terminalTransaction,
      "retention terminal finalize",
    );
    const retryStarted = deferred();
    const trackedRetry = trackSettlement(
      withDatabaseTransaction(prisma, async (tx) => {
        retryStarted.resolve();
        return retention(tx).claimDispatch({
          outboxId: terminalFirst.outboxId,
          publishAttempt: terminalFirst.publishAttempt,
          processingJobId: "retention-terminal-first",
          processingJobAttempt: 2,
          startedAt: new Date(),
        });
      }),
    );
    let retryWaitedForTerminal = false;
    try {
      await retryStarted.promise;
      await waitForBlockedDatabaseQuery(prisma);
      retryWaitedForTerminal = !trackedRetry.isSettled();
    } finally {
      releaseTerminal.resolve();
    }
    const [finalized, staleRetry] = await Promise.all([terminalTransaction, trackedRetry.promise]);
    expect(retryWaitedForTerminal).toBe(true);
    expect(finalized).toBe(true);
    expect(staleRetry).toBeNull();
    await expectRetentionOwnershipState(terminalFirst, {
      outboxStatus: "PUBLISHED",
      dispatchStatus: "SKIPPED",
    });

    const claimFirst = await stageRetentionPublication({
      userTag: "RTTERM02",
      lockedAt: new Date(),
    });
    const initialLease = await withDatabaseTransaction(prisma, (tx) =>
      retention(tx).claimDispatch({
        outboxId: claimFirst.outboxId,
        publishAttempt: claimFirst.publishAttempt,
        processingJobId: "retention-claim-first",
        processingJobAttempt: 1,
        startedAt: new Date(),
      }),
    );
    if (!initialLease) throw new Error("Expected retention claim-first lease");

    const retryOwnsRows = deferred();
    const releaseRetry = deferred();
    const retryTransaction = withDatabaseTransaction(prisma, async (tx) => {
      const retry = await retention(tx).claimDispatch({
        outboxId: claimFirst.outboxId,
        publishAttempt: claimFirst.publishAttempt,
        processingJobId: "retention-claim-first",
        processingJobAttempt: 2,
        startedAt: new Date(),
      });
      retryOwnsRows.resolve();
      await releaseRetry.promise;
      return retry;
    });
    await waitUntilTransactionHoldsLock(retryOwnsRows, retryTransaction, "retention retry claim");
    const staleFinalizeStarted = deferred();
    const trackedFinalize = trackSettlement(
      withDatabaseTransaction(prisma, async (tx) => {
        staleFinalizeStarted.resolve();
        return retention(tx).markDispatchSkipped(initialLease.fence, "NO_ACTIVE_TOKEN");
      }),
    );
    let finalizeWaitedForRetry = false;
    try {
      await staleFinalizeStarted.promise;
      await waitForBlockedDatabaseQuery(prisma);
      finalizeWaitedForRetry = !trackedFinalize.isSettled();
    } finally {
      releaseRetry.resolve();
    }
    const [retryLease, staleFinalized] = await Promise.all([
      retryTransaction,
      trackedFinalize.promise,
    ]);
    expect(finalizeWaitedForRetry).toBe(true);
    expect(retryLease?.fence.deliveryAttemptCount).toBe(
      initialLease.fence.deliveryAttemptCount + 1,
    );
    expect(staleFinalized).toBe(false);
    await expectRetentionOwnershipState(claimFirst, {
      outboxStatus: "PUBLISHED",
      dispatchStatus: "PROCESSING",
    });
  });

  it("final claim recovery는 matching PENDING generation만 CAS하고 partial exact recovery를 rollback한다", async () => {
    const user = await createUser("CLAIMREC");
    const first = await stageNotification({ userId: user.id, suffix: "claim-first" });
    const terminal = await stageNotification({ userId: user.id, suffix: "claim-terminal" });
    const publications = await withDatabaseTransaction(prisma, (tx) =>
      outbox(tx).claimByDispatchIds(
        [first.dispatchId, terminal.dispatchId],
        new Date("2026-08-29T00:00:00Z"),
      ),
    );
    await withDatabaseTransaction(prisma, (tx) =>
      outbox(tx).markPublished(publications, new Date("2026-08-29T00:00:01Z")),
    );
    decodeRecord(
      "PushDispatch",
      requireRecord(
        await prisma.orm.public.PushDispatch.where((row) => row.id.eq(terminal.dispatchId)).update(
          encodePatch("PushDispatch", { status: "SENT", sentAt: new Date() }),
        ),
      ),
    );

    await expect(
      withDatabaseTransaction(prisma, async (tx) => {
        const recovered = await lifecycle(tx).reopenAfterFinalClaimFailure({
          publications,
          availableAt: new Date(),
          error: "claim unavailable",
        });
        if (recovered !== publications.length) throw new Error("partial recovery");
      }),
    ).rejects.toThrow("partial recovery");
    await expect(
      prisma.orm.public.PushDispatchOutbox.where((row) => row.status.eq("PUBLISHED"))
        .aggregate((aggregate) => ({ count: aggregate.count() }))
        .then(({ count }) => count),
    ).resolves.toBe(2);

    await expect(
      withDatabaseTransaction(prisma, (tx) =>
        lifecycle(tx).reopenFailedPublications({
          publications,
          availableAt: new Date(),
          error: "dead-letter recovery",
        }),
      ),
    ).resolves.toBe(1);
    await expect(
      withDatabaseTransaction(prisma, (tx) =>
        lifecycle(tx).reopenFailedPublications({
          publications: [{ dispatchId: terminal.dispatchId, publishAttempt: 999 }],
          availableAt: new Date(),
          error: "stale generation",
        }),
      ),
    ).resolves.toBe(0);
  });

  it("일반 recovery는 outbox가 없는 retention dispatch와 RetentionPushOutbox를 건드리지 않는다", async () => {
    const user = await createUser("RETAIN01");
    const notification = await createNotification(user.id, "retention");
    const dispatch = decodeRecord(
      "PushDispatch",
      await prisma.orm.public.PushDispatch.create(
        encodeCreate("PushDispatch", {
          notificationId: notification.id,
          userId: user.id,
          purpose: "ENGAGEMENT",
          status: "PROCESSING",
          processingJobId: "retention-job",
          processingStartedAt: new Date("2026-08-01T00:00:00Z"),
        }),
      ),
    );
    const assignment = decodeRecord(
      "RetentionExperimentAssignment",
      await prisma.orm.public.RetentionExperimentAssignment.create(
        encodeCreate("RetentionExperimentAssignment", {
          userId: user.id,
          experimentKey: "retention-isolation",
          variant: "TREATMENT",
        }),
      ),
    );
    const stage = decodeRecord(
      "RetentionExperimentStage",
      await prisma.orm.public.RetentionExperimentStage.create(
        encodeCreate("RetentionExperimentStage", {
          assignmentId: assignment.id,
          stage: "D1",
          status: "OUTBOXED",
          notificationId: notification.id,
        }),
      ),
    );
    const retentionOutbox = decodeRecord(
      "RetentionPushOutbox",
      await prisma.orm.public.RetentionPushOutbox.create(
        encodeCreate("RetentionPushOutbox", {
          stageId: stage.id,
          notificationId: notification.id,
          dispatchId: dispatch.id,
          status: "PROCESSING",
          attempts: 2,
          lockedAt: new Date("2026-08-01T00:00:00Z"),
        }),
      ),
    );

    await withDatabaseTransaction(prisma, async (tx) => {
      await lifecycle(tx).recoverStaleProcessing(new Date("2026-08-02T00:00:00Z"));
      await outbox(tx).recoverStaleProcessing(new Date("2026-08-02T00:00:00Z"));
    });

    await expect(
      prisma.orm.public.PushDispatch.where((row) => row.id.eq(dispatch.id))
        .first()
        .then((row) => decodeRecord("PushDispatch", requireRecord(row))),
    ).resolves.toEqual(
      expect.objectContaining({ status: "PROCESSING", processingJobId: "retention-job" }),
    );
    await expect(
      prisma.orm.public.RetentionPushOutbox.where((row) => row.id.eq(retentionOutbox.id))
        .first()
        .then((row) => decodeRecord("RetentionPushOutbox", requireRecord(row))),
    ).resolves.toEqual(expect.objectContaining({ status: "PROCESSING", attempts: 2 }));
  });

  it("processing lease partial index가 migration 결과에 존재한다", async () => {
    const sqlRows2 = sqlRowSpec({ indexName: "pg/text@1" });
    const sqlRows3 = sqlRowSpec({ indexName: "pg/text@1" });
    const sqlRows4 = sqlRowSpec({ indexName: "pg/text@1" });

    const indexes = decodeSqlRows(
      sqlRows2,
      await prisma.runtime().query(
        sqlStatement(
          prisma,
          sql`
			SELECT indexname AS "indexName"
			FROM pg_indexes
			WHERE schemaname = 'public'
				AND tablename = 'PushDispatch'
		`,
        )
          .returnsRow(sqlRows2)
          .build(),
      ),
    );
    expect(indexes.map((index) => index.indexName)).toContain("PushDispatch_processing_lease_idx");
    const outboxIndexes = decodeSqlRows(
      sqlRows3,
      await prisma.runtime().query(
        sqlStatement(
          prisma,
          sql`
			SELECT indexname AS "indexName"
			FROM pg_indexes
			WHERE schemaname = 'public'
				AND tablename = 'PushDispatchOutbox'
		`,
        )
          .returnsRow(sqlRows3)
          .build(),
      ),
    );
    expect(outboxIndexes.map((index) => index.indexName)).toContain(
      "PushDispatchOutbox_status_availableAt_dispatchId_idx",
    );
    expect(outboxIndexes.map((index) => index.indexName)).not.toContain(
      "PushDispatchOutbox_status_publishedAt_idx",
    );
    const retentionIndexes = decodeSqlRows(
      sqlRows4,
      await prisma.runtime().query(
        sqlStatement(
          prisma,
          sql`
			SELECT indexname AS "indexName"
			FROM pg_indexes
			WHERE schemaname = 'public'
				AND tablename = 'RetentionPushOutbox'
		`,
        )
          .returnsRow(sqlRows4)
          .build(),
      ),
    );
    expect(retentionIndexes.map((index) => index.indexName)).toContain(
      "RetentionPushOutbox_status_availableAt_id_idx",
    );
    expect(retentionIndexes.map((index) => index.indexName)).not.toContain(
      "RetentionPushOutbox_status_availableAt_idx",
    );
  });
});
