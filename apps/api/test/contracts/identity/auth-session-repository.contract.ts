import { REVOKE_REASON } from "@aido/api/vocabulary";

import type { AuthSessionRepositoryPort } from "#api/modules/identity/auth/application/ports/auth-session.repository.port";
import type {
  AuthSession,
  AuthSessionPrimitives,
} from "#api/modules/identity/auth/domain/auth-session.aggregate";
import { SessionId } from "#api/modules/identity/auth/domain/session-id.vo";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  AUTH_FIXTURE_NOW,
  AUTH_FIXTURE_OTHER_USER_ID,
  AUTH_FIXTURE_USER_ID,
  createAuthSessionFixture,
} from "#test/fixtures/identity/auth-session.fixture";

const LATER = AUTH_FIXTURE_NOW.add({ minutes: 5 });
let hashSequence = 0;

async function saveSession(
  repository: AuthSessionRepositoryPort,
  overrides: Partial<AuthSessionPrimitives> = {},
): Promise<AuthSession> {
  hashSequence += 1;
  const session = createAuthSessionFixture({
    id: (await repository.nextId()).value,
    refreshTokenHash: `hash-${hashSequence}`,
    ...overrides,
  });
  await repository.save(session);
  return session;
}

export function describeAuthSessionRepositoryContract(
  createRepository: () => Promise<AuthSessionRepositoryPort>,
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

    it("다시 저장하면 회전·폐기 칸만 바꾸고 소유자·기기·생성 시각은 둔다", async () => {
      // Given
      const repository = await createRepository();
      const saved = await saveSession(repository);
      const changed = createAuthSessionFixture({
        ...saved.toPrimitives(),
        userId: AUTH_FIXTURE_OTHER_USER_ID,
        deviceFingerprint: "other-device",
        createdAt: LATER,
        refreshTokenHash: "rotated-hash",
        previousTokenHash: saved.refreshTokenHash,
        tokenVersion: 2,
        lastUsedAt: LATER,
        expiresAt: LATER.add({ hours: 24 }),
        revokedAt: LATER,
      });

      // When
      await repository.save(changed);
      const found = await repository.findById(saved.id);

      // Then
      expect(found?.toPrimitives()).toEqual({
        ...changed.toPrimitives(),
        userId: AUTH_FIXTURE_USER_ID,
        deviceFingerprint: saved.toPrimitives().deviceFingerprint,
        createdAt: saved.toPrimitives().createdAt,
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

    it("회전은 기대한 버전이고 폐기되지 않았을 때 한 번만 성공한다", async () => {
      // Given
      const repository = await createRepository();
      const saved = await saveSession(repository);
      const rotation = saved.planRotation("rotated-hash", LATER.add({ hours: 24 }));

      // When
      const first = await repository.rotateToken(saved.id, rotation, LATER);
      const stale = await repository.rotateToken(saved.id, rotation, LATER);
      const found = await repository.findById(saved.id);

      // Then
      expect({ first, stale }).toEqual({ first: true, stale: false });
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
      await repository.revoke(saved.id, REVOKE_REASON.USER_LOGOUT, LATER);

      // When
      const rotated = await repository.rotateToken(
        saved.id,
        saved.planRotation("rotated-hash", LATER.add({ hours: 24 })),
        LATER,
      );
      const found = await repository.findById(saved.id);

      // Then
      expect(rotated).toBe(false);
      expect(found?.toPrimitives()).toMatchObject({
        refreshTokenHash: saved.refreshTokenHash,
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
  });
}
