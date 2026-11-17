import { eq, sql } from "drizzle-orm";
import { vi } from "vitest";
import { z } from "zod";

import { SessionId } from "#api/modules/identity/sessions/domain/session-id.vo";
import { REVOKE_REASON } from "#api/modules/identity/sessions/domain/sessions.constants";
import { DrizzleSessionRepository } from "#api/modules/identity/sessions/infrastructure/persistence/drizzle-session.repository";
import { session as sessionTable, user as userTable } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createEntityId } from "#api/shared/domain/model/entity-id";
import { SessionFixture, UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const now = Temporal.Instant.from("2026-12-31T23:59:00.000Z");
const expiresAt = Temporal.Instant.from("2027-01-08T00:00:00Z");
const rotatedAt = Temporal.Instant.from("2026-12-31T23:59:00Z");

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
    repository = new DrizzleSessionRepository(
      createDatabaseTransactionFixture(client).transactionHost,
    );
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
          createdAt: now,
          updatedAt: now,
          emailVerifiedAt: now,
          aiUsageResetAt: now,
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

  // 폐기 사유 같은 저장 칸은 Aggregate에 없어 행을 직접 읽는다
  async function readSession(id: string) {
    const [row] = await client
      .select()
      .from(sessionTable)
      .where(sql`${sessionTable.id} = ${id}`);
    return row;
  }

  async function givenSession(overrides: Parameters<typeof SessionFixture.create>[0] = {}) {
    const fixture = SessionFixture.create({
      id: createEntityId(),
      userId,
      tokenFamily: "session-family",
      createdAt: now,
      updatedAt: now,
      lastUsedAt: now,
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
    const contenders = await Promise.all([
      repository.findById(SessionId.reconstitute(session.id)),
      repository.findById(SessionId.reconstitute(session.id)),
    ]);
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
    const rotations = ["first-hash", "second-hash"].map(async (hash, index) => {
      const contender = contenders[index];
      if (contender == null) {
        return false;
      }
      contender.rotate({ refreshTokenHash: hash, expiresAt, now: rotatedAt });
      return repository.save(contender);
    });

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
        { timeout: 5000, interval: 10 },
      );
    } finally {
      release.resolve();
      await Promise.allSettled([holdingLock, ...rotations]);
    }
    const results = await Promise.all(rotations);

    // Then
    expect(results.filter((isRotated) => isRotated)).toHaveLength(1);
    expect(results.filter((isRotated) => !isRotated)).toHaveLength(1);
    const persisted = await readSession(session.id);
    expect(persisted?.tokenVersion).toBe(2);
    expect(persisted?.previousTokenHash).toBe("current-hash");
    expect(["first-hash", "second-hash"]).toContain(persisted?.refreshTokenHash);
  });

  it("읽은 뒤 사라진 세션은 다시 넣지 않고 저장이 false다", async () => {
    // Given
    const session = await givenSession({ refreshTokenHash: "vanishing-hash", tokenVersion: 1 });
    const loaded = await repository.findById(SessionId.reconstitute(session.id));
    await client.delete(sessionTable).where(eq(sessionTable.id, session.id));
    loaded?.revoke(REVOKE_REASON.USER_LOGOUT, now);

    // When
    const saved = loaded == null ? true : await repository.save(loaded);

    // Then
    expect(saved).toBe(false);
    expect(await readSession(session.id)).toBeUndefined();
  });

  it("폐기한 세션은 버전이 일치해도 회전하거나 새 해시를 저장할 수 없다", async () => {
    // Given
    const session = await givenSession({ refreshTokenHash: "revoked-hash", tokenVersion: 1 });
    const [logout, refresh] = await Promise.all([
      repository.findById(SessionId.reconstitute(session.id)),
      repository.findById(SessionId.reconstitute(session.id)),
    ]);
    logout?.revoke(REVOKE_REASON.USER_LOGOUT, now);
    if (logout != null) {
      await repository.save(logout);
    }
    refresh?.rotate({ refreshTokenHash: "unauthorized-hash", expiresAt, now: rotatedAt });

    // When
    const result = refresh == null ? false : await repository.save(refresh);

    // Then
    expect(result).toBe(false);
    const persisted = await readSession(session.id);
    expect(persisted?.refreshTokenHash).toBe("revoked-hash");
    expect(persisted?.tokenVersion).toBe(1);
    expect(persisted?.revokedReason).toBe(REVOKE_REASON.USER_LOGOUT);
  });

  it("패밀리 폐기는 실제로 폐기한 ID만 반환하고 다른 패밀리와 기존 폐기 사유를 보존한다", async () => {
    // Given
    const first = await givenSession({ refreshTokenHash: "family-first" });
    const second = await givenSession({ refreshTokenHash: "family-second" });
    const alreadyRevoked = await givenSession({
      refreshTokenHash: "family-revoked",
      revokedAt: now,
      revokedReason: REVOKE_REASON.USER_LOGOUT,
    });
    const otherFamily = await givenSession({
      refreshTokenHash: "other-family-hash",
      tokenFamily: "other-family",
    });

    // When
    const revokedIds = await repository.revokeByTokenFamily(
      "session-family",
      REVOKE_REASON.TOKEN_REUSE_DETECTED,
      now,
    );
    const repeatedIds = await repository.revokeByTokenFamily(
      "session-family",
      REVOKE_REASON.TOKEN_REUSE_DETECTED,
      now,
    );

    // Then
    expect(revokedIds.map((id) => id.value).toSorted()).toEqual([first.id, second.id].toSorted());
    expect(repeatedIds).toEqual([]);
    expect((await readSession(first.id))?.revokedReason).toBe(REVOKE_REASON.TOKEN_REUSE_DETECTED);
    expect((await readSession(second.id))?.revokedAt).toBeInstanceOf(Temporal.Instant);
    expect((await readSession(alreadyRevoked.id))?.revokedReason).toBe(REVOKE_REASON.USER_LOGOUT);
    expect((await readSession(otherFamily.id))?.revokedAt).toBeNull();
  });

  it("전체 폐기는 실제 변경한 ID만 반환하고 제외 세션과 다른 사용자·기존 사유를 보존한다", async () => {
    // Given
    const current = await givenSession({ refreshTokenHash: "current-device" });
    const active = await givenSession({ refreshTokenHash: "other-device" });
    const expired = await givenSession({
      refreshTokenHash: "expired-device",
      expiresAt: now,
    });
    const revoked = await givenSession({
      refreshTokenHash: "already-revoked",
      revokedAt: now,
      revokedReason: REVOKE_REASON.USER_LOGOUT,
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
    const revokeAll = {
      userId: UserId.reconstitute(userId),
      reason: REVOKE_REASON.PASSWORD_CHANGED,
      now,
      exceptSessionId: SessionId.reconstitute(current.id),
    };
    const ids = await repository.revokeAllByUserId(revokeAll);
    const repeated = await repository.revokeAllByUserId(revokeAll);

    // Then
    expect(ids.map((id) => id.value).toSorted()).toEqual([active.id, expired.id].toSorted());
    expect(repeated).toEqual([]);
    expect((await readSession(current.id))?.revokedAt).toBeNull();
    expect((await readSession(otherSession.id))?.revokedAt).toBeNull();
    expect((await readSession(revoked.id))?.revokedReason).toBe(REVOKE_REASON.USER_LOGOUT);
    expect((await readSession(expired.id))?.revokedReason).toBe(REVOKE_REASON.PASSWORD_CHANGED);
  });
});
