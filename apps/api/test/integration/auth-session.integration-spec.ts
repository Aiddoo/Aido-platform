import { sql } from "drizzle-orm";
import { vi } from "vitest";
import { z } from "zod";

import { DrizzleSessionRepository } from "#api/modules/identity/auth/infrastructure/persistence/drizzle-session.repository";
import { createEntityId } from "#api/platform/database/entity-id";
import { session as sessionTable, user as userTable } from "#api/platform/database/schema/index";
import { SessionFixture, UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const currentTime = new Date("2026-12-31T23:59:00.000Z");
const expiresAt = new Date("2027-01-08T00:00:00.000Z");

function createDeferred() {
  let resolve: (() => void) | undefined;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve: () => resolve?.() };
}

describe("DrizzleSessionRepository 통합 테스트 — 세션 회전과 폐기 원자성", () => {
  let testDatabase: TestDatabase;
  let client: TestDatabaseClient;
  let repository: DrizzleSessionRepository;
  let userId: string;

  beforeAll(async () => {
    testDatabase = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 6 }) });
    client = await testDatabase.start();
    repository = new DrizzleSessionRepository(createDatabaseTransactionFixture(client).txHost);
  });

  beforeEach(async () => {
    await testDatabase.cleanup();
    const [user] = await client
      .insert(userTable)
      .values(
        UserFixture.create({
          id: createEntityId(),
          email: "session-owner@example.com",
          userTag: "SESSION1",
          createdAt: currentTime,
          updatedAt: currentTime,
          emailVerifiedAt: currentTime,
          aiUsageResetAt: currentTime,
        }),
      )
      .returning();
    if (user === undefined) {
      throw new Error("user fixture was not created");
    }
    userId = user.id;
  });

  afterAll(async () => {
    await testDatabase?.stop();
  });

  async function givenSession(overrides: Parameters<typeof SessionFixture.create>[0] = {}) {
    const fixture = SessionFixture.create({
      id: createEntityId(),
      userId,
      tokenFamily: "session-family",
      createdAt: currentTime,
      updatedAt: currentTime,
      lastUsedAt: currentTime,
      expiresAt,
      ...overrides,
    });
    const [created] = await client.insert(sessionTable).values(fixture).returning();
    if (created === undefined) {
      throw new Error("session fixture was not created");
    }
    return created;
  }

  it("같은 버전의 동시 회전 두 요청 중 하나만 성공하고 승자의 해시를 저장한다", async () => {
    // Given
    const session = await givenSession({ refreshTokenHash: "current-hash", tokenVersion: 1 });
    const locked = createDeferred();
    const release = createDeferred();
    const holdingLock = client.transaction(async (transaction) => {
      await transaction.execute(
        sql`SELECT ${sessionTable.id} FROM ${sessionTable} WHERE ${sessionTable.id} = ${session.id} FOR UPDATE`,
      );
      locked.resolve();
      await release.promise;
    });
    const lockReady = holdingLock.then(() => {
      throw new Error("두 회전 요청을 시작하기 전에 세션 lock이 해제되었습니다.");
    });
    await Promise.race([locked.promise, lockReady]);
    const rotations = ["first-hash", "second-hash"].map((hash) =>
      repository.rotateToken(session.id, {
        refreshTokenHash: hash,
        previousTokenHash: "current-hash",
        tokenVersion: 2,
        expectedTokenVersion: 1,
        expiresAt,
      }),
    );

    // When
    try {
      await vi.waitFor(
        async () => {
          const { rows } = await client.execute<{ count: number }>(
            sql`SELECT count(*)::int AS count FROM pg_stat_activity
            WHERE datname = current_database() AND wait_event_type = 'Lock'
              AND query ILIKE '%update%' AND query LIKE '%Session%'`,
          );
          const [waiting] = z.array(z.object({ count: z.number() })).parse(rows);
          expect(waiting?.count).toBe(2);
        },
        { timeout: 5_000, interval: 10 },
      );
    } finally {
      release.resolve();
      await Promise.allSettled([holdingLock, ...rotations]);
    }
    const results = await Promise.all(rotations);

    // Then
    const successful = results.filter((result) => result !== null);
    expect(successful).toHaveLength(1);
    expect(results.filter((result) => result === null)).toHaveLength(1);
    const persisted = await repository.findById(session.id);
    expect(persisted?.tokenVersion).toBe(2);
    expect(persisted?.previousTokenHash).toBe("current-hash");
    expect(persisted?.refreshTokenHash).toBe(successful[0]?.refreshTokenHash);
  });

  it("폐기한 세션은 버전이 일치해도 회전하거나 새 해시를 저장할 수 없다", async () => {
    // Given
    const session = await givenSession({ refreshTokenHash: "revoked-hash", tokenVersion: 1 });
    await repository.revoke(session.id, "user_logout");

    // When
    const result = await repository.rotateToken(session.id, {
      refreshTokenHash: "unauthorized-hash",
      previousTokenHash: "revoked-hash",
      tokenVersion: 2,
      expectedTokenVersion: 1,
      expiresAt,
    });

    // Then
    expect(result).toBeNull();
    const persisted = await repository.findById(session.id);
    expect(persisted?.refreshTokenHash).toBe("revoked-hash");
    expect(persisted?.tokenVersion).toBe(1);
    expect(persisted?.revokedReason).toBe("user_logout");
  });

  it("패밀리 폐기는 실제로 폐기한 ID만 반환하고 다른 패밀리와 기존 폐기 사유를 보존한다", async () => {
    // Given
    const first = await givenSession({ refreshTokenHash: "family-first" });
    const second = await givenSession({ refreshTokenHash: "family-second" });
    const alreadyRevoked = await givenSession({
      refreshTokenHash: "family-revoked",
      revokedAt: currentTime,
      revokedReason: "user_logout",
    });
    const otherFamily = await givenSession({
      refreshTokenHash: "other-family-hash",
      tokenFamily: "other-family",
    });

    // When
    const revokedIds = await repository.revokeByTokenFamily(
      "session-family",
      "token_reuse_detected",
    );
    const repeatedIds = await repository.revokeByTokenFamily(
      "session-family",
      "token_reuse_detected",
    );

    // Then
    expect(revokedIds.toSorted()).toEqual([first.id, second.id].toSorted());
    expect(repeatedIds).toEqual([]);
    expect((await repository.findById(first.id))?.revokedReason).toBe("token_reuse_detected");
    expect((await repository.findById(second.id))?.revokedAt).toBeInstanceOf(Date);
    expect((await repository.findById(alreadyRevoked.id))?.revokedReason).toBe("user_logout");
    expect((await repository.findById(otherFamily.id))?.revokedAt).toBeNull();
  });

  it("전체 폐기는 실제 변경한 ID만 반환하고 제외 세션과 다른 사용자·기존 사유를 보존한다", async () => {
    // Given
    const current = await givenSession({ refreshTokenHash: "current-device" });
    const active = await givenSession({ refreshTokenHash: "other-device" });
    const expired = await givenSession({
      refreshTokenHash: "expired-device",
      expiresAt: currentTime,
    });
    const revoked = await givenSession({
      refreshTokenHash: "already-revoked",
      revokedAt: currentTime,
      revokedReason: "user_logout",
    });
    const [otherUser] = await client
      .insert(userTable)
      .values(UserFixture.create({ id: createEntityId(), userTag: "OTHER001" }))
      .returning();
    if (otherUser === undefined) {
      throw new Error("other user fixture was not created");
    }
    const otherSession = await givenSession({
      userId: otherUser.id,
      refreshTokenHash: "other-user-device",
    });

    // When
    const ids = await repository.revokeAllByUserId(userId, "password_changed", current.id);
    const repeated = await repository.revokeAllByUserId(userId, "password_changed", current.id);

    // Then
    expect(ids.toSorted()).toEqual([active.id, expired.id].toSorted());
    expect(repeated).toEqual([]);
    expect((await repository.findById(current.id))?.revokedAt).toBeNull();
    expect((await repository.findById(otherSession.id))?.revokedAt).toBeNull();
    expect((await repository.findById(revoked.id))?.revokedReason).toBe("user_logout");
    expect((await repository.findById(expired.id))?.revokedReason).toBe("password_changed");
  });
});
