import sql from "sql-template-tag";
import { vi } from "vitest";

import { SessionRepository } from "#api/modules/identity/infrastructure/persistence/auth/session.repository";
import { encodeCreate } from "#api/platform/database/database-records";
import { sqlStatement } from "#api/platform/database/database-sql";
import { createEntityId } from "#api/platform/database/database-values";
import { SessionFixture, UserFixture } from "#test/fixtures/index";
import {
  createDatabaseTransactionFixture,
  createTestClient,
  withDatabaseTransaction,
} from "#test/setup/database-context";
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

describe("SessionRepository 통합 테스트 — 세션 회전과 폐기 원자성", () => {
  let testDatabase: TestDatabase;
  let client: TestDatabaseClient;
  let repository: SessionRepository;
  let userId: string;

  beforeAll(async () => {
    testDatabase = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 6 }) });
    client = await testDatabase.start();
    repository = new SessionRepository(createDatabaseTransactionFixture(client).txHost);
  });

  beforeEach(async () => {
    await testDatabase.cleanup();
    const user = await client.orm.public.User.create(
      encodeCreate(
        "User",
        UserFixture.create({
          id: createEntityId(),
          email: "session-owner@example.com",
          userTag: "SESSION1",
          createdAt: currentTime,
          updatedAt: currentTime,
          emailVerifiedAt: currentTime,
          aiUsageResetAt: currentTime,
        }),
      ),
    );
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
    return client.orm.public.Session.create(encodeCreate("Session", fixture));
  }

  it("같은 버전의 동시 회전 두 요청 중 하나만 성공하고 승자의 해시를 저장한다", async () => {
    // Given
    const session = await givenSession({ refreshTokenHash: "current-hash", tokenVersion: 1 });
    const locked = createDeferred();
    const release = createDeferred();
    const holdingLock = withDatabaseTransaction(client, async (transaction) => {
      await transaction.query(
        sqlStatement(transaction, sql`SELECT id FROM "Session" WHERE id = ${session.id} FOR UPDATE`)
          .returnsRow({ id: "pg/text@1" })
          .build(),
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

    // When - 두 UPDATE가 실제 row lock에서 대기한 뒤 동시에 진행한다.
    try {
      await vi.waitFor(
        async () => {
          const waiting = await client.runtime().query(
            client.raw.sql`SELECT count(*)::int AS count FROM pg_stat_activity
            WHERE datname = current_database() AND wait_event_type = 'Lock'
              AND query ILIKE '%update%' AND query LIKE '%Session%'`
              .returnsRow({ count: "pg/int4@1" })
              .build(),
          );
          expect(waiting[0]?.count).toBe(2);
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
});
