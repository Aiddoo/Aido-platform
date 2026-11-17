import type { SessionRepositoryPort } from "#api/modules/identity/sessions/application/ports/session.repository.port";
import { SessionId } from "#api/modules/identity/sessions/domain/session-id.vo";
import {
  Session,
  type SessionPrimitives,
} from "#api/modules/identity/sessions/domain/session.aggregate";
import { REVOKE_REASON } from "#api/modules/identity/sessions/domain/sessions.constants";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  AUTH_FIXTURE_NOW,
  AUTH_FIXTURE_OTHER_USER_ID,
  AUTH_FIXTURE_USER_ID,
} from "#test/fixtures/identity/session.fixture";

const LATER = AUTH_FIXTURE_NOW.add({ minutes: 5 });
let hashSequence = 0;

async function saveSession(
  repository: SessionRepositoryPort,
  overrides: Partial<SessionPrimitives> = {},
): Promise<Session> {
  hashSequence += 1;
  const session = Session.create({
    id: await repository.nextId(),
    userId: overrides.userId ?? AUTH_FIXTURE_USER_ID,
    refreshTokenHash: overrides.refreshTokenHash ?? `hash-${hashSequence}`,
    tokenFamily: overrides.tokenFamily ?? "token-family",
    deviceFingerprint: "Aido/1.15.0",
    userAgent: "Aido/1.15.0",
    ipAddress: "127.0.0.1",
    expiresAt: overrides.expiresAt ?? AUTH_FIXTURE_NOW.add({ hours: 24 * 7 }),
    now: overrides.lastUsedAt ?? AUTH_FIXTURE_NOW,
  });
  if (overrides.revokedAt != null) {
    session.revoke(REVOKE_REASON.USER_LOGOUT, overrides.revokedAt);
  }
  await repository.save(session);
  return session;
}

async function loadSession(repository: SessionRepositoryPort, id: SessionId): Promise<Session> {
  const found = await repository.findById(id);
  if (found == null) {
    throw new Error(`session ${id.value} was not saved`);
  }
  return found;
}

export function describeSessionRepositoryContract(
  createRepository: () => Promise<SessionRepositoryPort>,
): void {
  describe("인증 세션 저장소 계약", () => {
    it("nextId는 부를 때마다 다른 id를 준다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const ids = [await repository.nextId(), await repository.nextId()];

      // Then
      expect(ids[0]?.equals(ids[1] ?? ids[0])).toBe(false);
    });

    it("저장한 세션은 id와 refresh 토큰 hash로 같은 값을 다시 읽는다", async () => {
      // Given
      const repository = await createRepository();
      const saved = await saveSession(repository, {
        previousTokenHash: "previous-hash",
        tokenVersion: 3,
        deviceFingerprint: "iPhone 17",
      });

      // When
      const byId = await repository.findById(saved.id);
      const byHash = await repository.findByRefreshTokenHash(saved.refreshTokenHash);

      // Then
      expect(byId?.toPrimitives()).toEqual(saved.toPrimitives());
      expect(byHash?.toPrimitives()).toEqual(saved.toPrimitives());
    });

    it("없는 세션은 찾지 못한다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const byId = await repository.findById(UserId.reconstitute("missing-session"));
      const byHash = await repository.findByRefreshTokenHash("missing-hash");

      // Then
      expect({ byId, byHash }).toEqual({ byId: null, byHash: null });
    });

    it("회전·폐기한 세션을 저장하면 그 칸만 바꾸고 소유자·기기·생성 시각은 둔다", async () => {
      // Given
      const repository = await createRepository();
      const saved = await saveSession(repository);
      const changed = await loadSession(repository, saved.id);
      changed.rotate({
        refreshTokenHash: "rotated-hash",
        expiresAt: LATER.add({ hours: 24 }),
        now: LATER,
      });
      changed.revoke(REVOKE_REASON.USER_LOGOUT, LATER);

      // When
      const result = await repository.save(changed);
      const found = await repository.findById(saved.id);

      // Then
      expect(result).toBe(true);
      expect(found?.toPrimitives()).toEqual({
        ...saved.toPrimitives(),
        refreshTokenHash: "rotated-hash",
        previousTokenHash: saved.refreshTokenHash,
        tokenVersion: saved.tokenVersion + 1,
        lastUsedAt: LATER,
        updatedAt: LATER,
        expiresAt: LATER.add({ hours: 24 }),
        revokedAt: LATER,
        revokedReason: REVOKE_REASON.USER_LOGOUT,
      });
    });

    it("활성 세션은 그 사용자의 폐기·만료되지 않은 것만 최근 사용 순으로 준다", async () => {
      // Given
      const repository = await createRepository();
      const older = await saveSession(repository, { lastUsedAt: AUTH_FIXTURE_NOW });
      const newer = await saveSession(repository, { lastUsedAt: LATER });
      await saveSession(repository, { revokedAt: AUTH_FIXTURE_NOW });
      await saveSession(repository, { expiresAt: LATER });
      await saveSession(repository, { userId: AUTH_FIXTURE_OTHER_USER_ID });

      // When
      const active = await repository.listActiveByUserId(
        UserId.reconstitute(AUTH_FIXTURE_USER_ID),
        LATER,
      );

      // Then
      expect(active.map((session) => session.id.value)).toEqual([newer.id.value, older.id.value]);
    });

    it("회전은 읽을 때의 버전이고 폐기되지 않았을 때 한 번만 성공한다", async () => {
      // Given
      const repository = await createRepository();
      const saved = await saveSession(repository);
      const winner = await loadSession(repository, saved.id);
      const stale = await loadSession(repository, saved.id);
      winner.rotate({
        refreshTokenHash: "rotated-hash",
        expiresAt: LATER.add({ hours: 24 }),
        now: LATER,
      });
      stale.rotate({
        refreshTokenHash: "stale-hash",
        expiresAt: LATER.add({ hours: 24 }),
        now: LATER,
      });

      // When
      const first = await repository.save(winner);
      const second = await repository.save(stale);
      const found = await repository.findById(saved.id);

      // Then
      expect({ first, second }).toEqual({ first: true, second: false });
      expect(found?.toPrimitives()).toMatchObject({
        refreshTokenHash: "rotated-hash",
        previousTokenHash: saved.refreshTokenHash,
        tokenVersion: saved.tokenVersion + 1,
        lastUsedAt: LATER,
        expiresAt: LATER.add({ hours: 24 }),
      });
    });

    it("폐기한 세션은 버전이 맞아도 회전하지 않는다", async () => {
      // Given
      const repository = await createRepository();
      const saved = await saveSession(repository);
      const logout = await loadSession(repository, saved.id);
      const refresh = await loadSession(repository, saved.id);
      logout.revoke(REVOKE_REASON.USER_LOGOUT, LATER);
      await repository.save(logout);
      refresh.rotate({
        refreshTokenHash: "rotated-hash",
        expiresAt: LATER.add({ hours: 24 }),
        now: LATER,
      });

      // When
      const rotated = await repository.save(refresh);
      const found = await repository.findById(saved.id);

      // Then
      expect(rotated).toBe(false);
      expect(found?.toPrimitives()).toMatchObject({
        refreshTokenHash: saved.refreshTokenHash,
        revokedAt: LATER,
      });
    });

    it("두 번째 폐기 저장은 false이고 처음 폐기 시각과 사유를 덮지 않는다", async () => {
      // Given
      const repository = await createRepository();
      const saved = await saveSession(repository);
      const logout = await loadSession(repository, saved.id);
      const revokeFromList = await loadSession(repository, saved.id);
      logout.revoke(REVOKE_REASON.USER_LOGOUT, LATER);
      revokeFromList.revoke(REVOKE_REASON.USER_REVOKE, LATER.add({ minutes: 5 }));

      // When
      const first = await repository.save(logout);
      const second = await repository.save(revokeFromList);
      const found = await repository.findById(saved.id);

      // Then
      expect({ first, second }).toEqual({ first: true, second: false });
      expect(found?.toPrimitives()).toMatchObject({
        revokedAt: LATER,
        revokedReason: REVOKE_REASON.USER_LOGOUT,
      });
    });

    it("그 사이 회전한 세션도 폐기하고 회전한 토큰 칸은 덮지 않는다", async () => {
      // Given
      const repository = await createRepository();
      const saved = await saveSession(repository);
      const refresh = await loadSession(repository, saved.id);
      const logout = await loadSession(repository, saved.id);
      refresh.rotate({
        refreshTokenHash: "rotated-hash",
        expiresAt: LATER.add({ hours: 24 }),
        now: LATER,
      });
      await repository.save(refresh);
      logout.revoke(REVOKE_REASON.USER_LOGOUT, LATER);

      // When
      const revoked = await repository.save(logout);
      const found = await repository.findById(saved.id);

      // Then
      expect(revoked).toBe(true);
      expect(found?.toPrimitives()).toMatchObject({
        refreshTokenHash: "rotated-hash",
        tokenVersion: saved.tokenVersion + 1,
        revokedAt: LATER,
      });
    });

    it("토큰 계열 폐기는 아직 살아 있는 같은 계열만 폐기하고 그 id를 준다", async () => {
      // Given
      const repository = await createRepository();
      const first = await saveSession(repository, { tokenFamily: "family-a" });
      const second = await saveSession(repository, { tokenFamily: "family-a" });
      await saveSession(repository, { tokenFamily: "family-a", revokedAt: AUTH_FIXTURE_NOW });
      const other = await saveSession(repository, { tokenFamily: "family-b" });

      // When
      const revoked = await repository.revokeByTokenFamily(
        "family-a",
        REVOKE_REASON.TOKEN_REUSE_DETECTED,
        LATER,
      );
      const repeated = await repository.revokeByTokenFamily(
        "family-a",
        REVOKE_REASON.TOKEN_REUSE_DETECTED,
        LATER,
      );

      // Then
      expect(revoked.map((id) => id.value).toSorted()).toEqual(
        [first.id.value, second.id.value].toSorted(),
      );
      expect(repeated).toEqual([]);
      expect((await repository.findById(first.id))?.revokedAt).toEqual(LATER);
      expect((await repository.findById(other.id))?.revokedAt).toBeNull();
    });

    it("사용자 전체 폐기는 제외한 세션과 다른 사용자를 두고 바꾼 id만 준다", async () => {
      // Given
      const repository = await createRepository();
      const current = await saveSession(repository);
      const another = await saveSession(repository);
      await saveSession(repository, { revokedAt: AUTH_FIXTURE_NOW });
      const otherUser = await saveSession(repository, { userId: AUTH_FIXTURE_OTHER_USER_ID });
      const params = {
        userId: UserId.reconstitute(AUTH_FIXTURE_USER_ID),
        reason: REVOKE_REASON.PASSWORD_CHANGED,
        now: LATER,
        exceptSessionId: current.id,
      };

      // When
      const revoked = await repository.revokeAllByUserId(params);
      const repeated = await repository.revokeAllByUserId(params);

      // Then
      expect(revoked).toEqual([another.id]);
      expect(repeated).toEqual([]);
      expect((await repository.findById(current.id))?.revokedAt).toBeNull();
      expect((await repository.findById(otherUser.id))?.revokedAt).toBeNull();
    });

    it("제외할 세션 id가 비어 있으면 그 사용자의 세션을 모두 폐기한다", async () => {
      // Given
      const repository = await createRepository();
      const first = await saveSession(repository);
      const second = await saveSession(repository);

      // When
      const revoked = await repository.revokeAllByUserId({
        userId: UserId.reconstitute(AUTH_FIXTURE_USER_ID),
        reason: REVOKE_REASON.ACCOUNT_DELETION,
        now: LATER,
        exceptSessionId: SessionId.reconstitute(""),
      });

      // Then
      expect(revoked.map((id) => id.value).toSorted()).toEqual(
        [first.id.value, second.id.value].toSorted(),
      );
    });

    it("폐기나 만료가 기준 시각 전인 세션만 limit개씩 지우고 쓰는 세션은 둔다", async () => {
      // Given
      const repository = await createRepository();
      const justBefore = AUTH_FIXTURE_NOW.subtract({ milliseconds: 1 });
      const revokedBefore = await saveSession(repository, { revokedAt: justBefore });
      const expiredBefore = await saveSession(repository, { expiresAt: justBefore });
      const kept = [
        await saveSession(repository, { revokedAt: AUTH_FIXTURE_NOW }),
        await saveSession(repository, { expiresAt: AUTH_FIXTURE_NOW }),
        await saveSession(repository),
      ];

      // When
      const deletedCounts = [
        await repository.deleteEndedBefore(AUTH_FIXTURE_NOW, 1),
        await repository.deleteEndedBefore(AUTH_FIXTURE_NOW, 1),
        await repository.deleteEndedBefore(AUTH_FIXTURE_NOW, 1),
      ];

      // Then
      expect(deletedCounts).toEqual([1, 1, 0]);
      expect(await repository.findById(revokedBefore.id)).toBeNull();
      expect(await repository.findById(expiredBefore.id)).toBeNull();
      for (const session of kept) {
        expect((await repository.findById(session.id))?.id).toEqual(session.id);
      }
    });
  });
}
