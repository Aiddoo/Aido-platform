import { sql } from "drizzle-orm";
import { vi } from "vitest";
import { z } from "zod";

import { DrizzleSecurityLogRepository } from "#api/modules/identity/auth/infrastructure/persistence/drizzle-security-log.repository";
import { PurgeDeletedAccountsUseCase } from "#api/modules/identity/users/application/use-cases/purge-deleted-accounts.use-case";
import { DrizzleUserRepository } from "#api/modules/identity/users/infrastructure/persistence/drizzle-user.repository";
import { createEntityId } from "#api/platform/database/entity-id";
import { securityLog, user as userTable } from "#api/platform/database/schema/index";
import { DateClock } from "#test/doubles/platform/date-clock";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const now = Temporal.Instant.from("2027-01-01T00:00:00Z");
const at = new Date(now.epochMilliseconds);
const cutoff = Temporal.Instant.from("2026-12-02T00:00:00.000Z");

describe("DrizzleUserRepository 통합 테스트 — 계정 생명주기", () => {
  let testDatabase: TestDatabase;
  let client: TestDatabaseClient;
  let repository: DrizzleUserRepository;

  beforeAll(async () => {
    testDatabase = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 6 }) });
    client = await testDatabase.start();
    repository = new DrizzleUserRepository(
      createDatabaseTransactionFixture(client).txHost,
      new DateClock(),
    );
  });

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at);
    await testDatabase.cleanup();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await testDatabase?.stop();
  });

  async function givenUser(overrides: Parameters<typeof UserFixture.create>[0] = {}) {
    const fixture = UserFixture.create({
      id: createEntityId(),
      createdAt: now,
      updatedAt: now,
      aiUsageResetAt: now,
      ...overrides,
    });
    await client.insert(userTable).values(fixture);
    return fixture;
  }

  it("Aggregate의 탈퇴 시각을 그대로 저장하고 프로필 조회에도 탈퇴 상태를 반환한다", async () => {
    // Given
    const fixture = await givenUser();
    await repository.createProfile(fixture.id, { name: "테스트 사용자" });
    const user = await repository.findById(fixture.id);
    user?.requestDeletion(now);

    // When
    if (user != null) {
      await repository.saveAccountStatus(user);
    }
    const persisted = await repository.findByIdWithProfile(fixture.id);

    // Then
    expect(persisted).toMatchObject({
      status: "SUSPENDED",
      deletedAt: now,
      profile: { name: "테스트 사용자", profileImage: null },
    });
  });

  it("같은 기준 시각으로 30일 경계 이전 계정만 영구 삭제 후보로 선택한다", async () => {
    // Given
    const before = await givenUser({ deletedAt: cutoff.subtract({ milliseconds: 1 }) });
    await givenUser({ deletedAt: cutoff });
    await givenUser({ deletedAt: cutoff.add({ milliseconds: 1 }) });
    await givenUser({ deletedAt: null });

    // When
    const candidates = await repository.listPurgeEligible(now);

    // Then
    expect(candidates.map((user) => user.toPrimitives())).toEqual([
      expect.objectContaining({
        id: before.id,
        email: before.email,
        deletedAt: cutoff.subtract({ milliseconds: 1 }),
      }),
    ]);
  });

  it("복구는 상태와 탈퇴 시각을 함께 저장하고 이후 영구 삭제 후보에서 제외한다", async () => {
    // Given
    const fixture = await givenUser({
      status: "SUSPENDED",
      deletedAt: cutoff.add({ milliseconds: 1 }),
    });
    const user = await repository.findById(fixture.id);
    const isRestored = user?.restore(now) ?? false;

    // When
    if (user != null) {
      await repository.saveAccountStatus(user);
    }

    // Then
    expect(isRestored).toBe(true);
    expect((await repository.findById(fixture.id))?.toPrimitives()).toMatchObject({
      status: "ACTIVE",
      deletedAt: null,
    });
    expect(
      await repository.listPurgeEligible(Temporal.Instant.from("2027-02-01T00:00:00Z")),
    ).toEqual([]);
  });

  function givenPurge() {
    const transaction = createDatabaseTransactionFixture(client);
    const userRepository = new DrizzleUserRepository(transaction.txHost, new DateClock());
    const securityLogRepository = new DrizzleSecurityLogRepository(transaction.txHost);
    const notificationCleanup = {
      cleanupInTransaction: async () => ({ affectedUserIds: [] }),
      settleAfterCommit: vi.fn(async () => {}),
    };
    const todoCommentCleanup = {
      cleanupInTransaction: async () => ({ affectedTodoIds: [] }),
      settleAfterCommit: vi.fn(async () => {}),
    };
    const logger = { log: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const dependencies = {
      userRepository,
      securityLogRepository,
      notificationCleanup,
      todoCommentCleanup,
      usageCleanup: { cleanupInTransaction: async () => undefined },
      unitOfWork: transaction.uow,
      clock: new FixedClock(now),
      logger,
    };
    return { dependencies, purge: new PurgeDeletedAccountsUseCase(dependencies) };
  }

  it("후보 조회 후 탈퇴 상태가 해제된 계정은 lock 이후 재검증하여 삭제하지 않는다", async () => {
    // Given
    const user = await givenUser({
      status: "SUSPENDED",
      deletedAt: cutoff.subtract({ milliseconds: 1 }),
    });
    const { dependencies } = givenPurge();
    const purge = new PurgeDeletedAccountsUseCase({
      ...dependencies,
      userRepository: {
        listPurgeEligible: async (checkedAt) => {
          const candidates = await repository.listPurgeEligible(checkedAt);
          await client
            .update(userTable)
            .set({ status: "ACTIVE", deletedAt: null })
            .where(sql`${userTable.id} = ${user.id}`);
          return candidates;
        },
        findByIdForUpdate: (id) => dependencies.userRepository.findByIdForUpdate(id),
        hardDelete: (id) => dependencies.userRepository.hardDelete(id),
      },
    });

    // When
    await purge.execute();

    // Then
    expect((await repository.findById(user.id))?.toPrimitives()).toMatchObject({
      status: "ACTIVE",
      deletedAt: null,
    });
    expect(await client.select().from(securityLog)).toEqual([]);
    expect(dependencies.notificationCleanup.settleAfterCommit).not.toHaveBeenCalled();
    expect(dependencies.logger.log).toHaveBeenCalledWith(
      expect.objectContaining({ purgedCount: 0, skippedCount: 1, failedCount: 0 }),
    );
  });

  it("감사 기록의 실제 FK 오류가 발생하면 계정 삭제도 rollback하고 정산하지 않는다", async () => {
    // Given
    const user = await givenUser({
      status: "SUSPENDED",
      deletedAt: cutoff.subtract({ milliseconds: 1 }),
    });
    await repository.createProfile(user.id, { name: "보존할 프로필" });
    const { dependencies } = givenPurge();
    const purge = new PurgeDeletedAccountsUseCase({
      ...dependencies,
      securityLogRepository: {
        create: (data) =>
          dependencies.securityLogRepository.create({
            ...data,
            event: "ACCOUNT_HARD_DELETED",
            userId: "missing-audit-user",
          }),
      },
    });

    // When
    await purge.execute();

    // Then
    expect(await repository.findByIdWithProfile(user.id)).toMatchObject({
      deletedAt: user.deletedAt,
      profile: { name: "보존할 프로필" },
    });
    expect(await client.select().from(securityLog)).toEqual([]);
    expect(dependencies.notificationCleanup.settleAfterCommit).not.toHaveBeenCalled();
    expect(dependencies.todoCommentCleanup.settleAfterCommit).not.toHaveBeenCalled();
    expect(dependencies.logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        purgedCount: 0,
        skippedCount: 0,
        failedCount: 1,
      }),
    );
  });

  it("같은 계정의 동시 purge는 row lock으로 직렬화하고 감사 기록을 한 번만 저장한다", async () => {
    // Given
    const user = await givenUser({
      status: "SUSPENDED",
      deletedAt: cutoff.subtract({ milliseconds: 1 }),
    });
    const { dependencies, purge } = givenPurge();
    let release: (() => void) | undefined;
    let locked: (() => void) | undefined;
    const releasePromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    const lockedPromise = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const holdingLock = client.transaction(async (transaction) => {
      await transaction.execute(
        sql`SELECT ${userTable.id} FROM ${userTable} WHERE ${userTable.id} = ${user.id} FOR UPDATE`,
      );
      locked?.();
      await releasePromise;
    });
    await Promise.race([
      lockedPromise,
      holdingLock.then(() => {
        throw new Error("동시 purge를 시작하기 전에 User row lock이 해제되었습니다.");
      }),
    ]);
    const purges = [purge.execute(), purge.execute()];

    // When
    try {
      await vi.waitFor(async () => {
        const { rows } = await client.execute<{ count: number }>(sql`
          SELECT count(*)::int AS count FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'
            AND query ILIKE '%FOR NO KEY UPDATE%' AND query LIKE '%User%'
        `);
        const [waiting] = z.array(z.object({ count: z.number() })).parse(rows);
        expect(waiting?.count).toBe(2);
      });
    } finally {
      release?.();
      await holdingLock;
      await Promise.all(purges);
    }

    // Then
    expect(await repository.findById(user.id)).toBeNull();
    const audits = await client.select().from(securityLog);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ userId: null, event: "ACCOUNT_HARD_DELETED" });
    expect(dependencies.notificationCleanup.settleAfterCommit).toHaveBeenCalledTimes(1);
    expect(dependencies.logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        purgedCount: 1,
        skippedCount: 0,
        failedCount: 0,
      }),
    );
    expect(dependencies.logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        purgedCount: 0,
        skippedCount: 1,
        failedCount: 0,
      }),
    );
  });
});
