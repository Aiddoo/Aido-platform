import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import {
  REVOKE_REASON,
  SECURITY_EVENT,
} from "#api/modules/identity/domain/constants/auth/auth.constants";
import {
  AUTH_CREDENTIAL_PASSWORD,
  AUTH_CREDENTIAL_TIME,
  createAuthCredentialFixture,
} from "#test/fixtures/auth-credential.fixture";
import { SessionFixture } from "#test/fixtures/session.fixture";

import { ChangePassword } from "./change-password.use-case.js";

describe("ChangePassword — 현재 기기를 유지하는 비밀번호 변경", () => {
  const newPassword = "NewPassword2!";
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AUTH_CREDENTIAL_TIME);
  });
  afterEach(() => vi.useRealTimers());

  it("현재 기기와 다른 사용자는 유지하고 나머지 폐기 세션 캐시만 삭제한다", async () => {
    // Given
    const fixture = createAuthCredentialFixture();
    const useCase = new ChangePassword(fixture);
    const currentSession = SessionFixture.create({ id: "current-device", userId: fixture.user.id });
    const otherSession = SessionFixture.create({ id: "other-device", userId: fixture.user.id });
    const otherUserSession = SessionFixture.create({
      id: "other-user-device",
      userId: "other-user",
    });
    for (const session of [currentSession, otherSession, otherUserSession]) {
      fixture.sessionRepository.sessions.set(session.id, session);
      fixture.cacheService.sessionIds.add(session.id);
    }
    const metadata = { ip: "192.0.2.11", userAgent: "현재 기기" };

    // When
    const result = await useCase.execute({
      userId: fixture.user.id,
      currentPassword: AUTH_CREDENTIAL_PASSWORD,
      newPassword,
      currentSessionId: currentSession.id,
      metadata,
    });

    // Then
    expect(result.message).toBe("비밀번호가 변경되었습니다.");
    expect(
      await fixture.accountRepository.findByUserIdAndProvider(fixture.user.id, "CREDENTIAL"),
    ).toMatchObject({ password: `digest:${newPassword}` });
    expect(fixture.sessionRepository.sessions.get(otherSession.id)?.revokedAt).toEqual(
      AUTH_CREDENTIAL_TIME,
    );
    expect(fixture.sessionRepository.revocationReasons.get(otherSession.id)).toBe(
      REVOKE_REASON.PASSWORD_CHANGED,
    );
    expect(fixture.cacheService.sessionIds.has(otherSession.id)).toBe(false);
    for (const session of [currentSession, otherUserSession]) {
      expect(fixture.sessionRepository.sessions.get(session.id)?.revokedAt).toBeNull();
      expect(fixture.cacheService.sessionIds.has(session.id)).toBe(true);
    }
    expect(fixture.securityLogRepository.entries).toEqual([
      {
        userId: fixture.user.id,
        event: SECURITY_EVENT.PASSWORD_CHANGED,
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
      },
    ]);
  });

  it("현재 세션을 지정하지 않은 기존 호출은 모든 기기를 폐기한다", async () => {
    // Given
    const fixture = createAuthCredentialFixture();
    const useCase = new ChangePassword(fixture);
    const session = SessionFixture.create({ userId: fixture.user.id });
    fixture.sessionRepository.sessions.set(session.id, session);
    fixture.cacheService.sessionIds.add(session.id);

    // When
    await useCase.execute({
      userId: fixture.user.id,
      currentPassword: AUTH_CREDENTIAL_PASSWORD,
      newPassword,
    });

    // Then
    expect(fixture.sessionRepository.sessions.get(session.id)?.revokedAt).toEqual(
      AUTH_CREDENTIAL_TIME,
    );
    expect(fixture.cacheService.sessionIds.has(session.id)).toBe(false);
  });

  it.each(["존재하지 않는", "탈퇴한", "소셜 전용", "비밀번호가 없는"] as const)(
    "%s 사용자의 변경은 해싱과 쓰기 이전에 거부한다",
    async (state) => {
      // Given
      const fixture = createAuthCredentialFixture({
        empty: state === "존재하지 않는",
        socialOnly: state === "소셜 전용",
      });
      if (state === "탈퇴한")
        await fixture.userRepository.softDelete(fixture.user.id, AUTH_CREDENTIAL_TIME);
      if (state === "비밀번호가 없는")
        for (const account of fixture.accountRepository.accounts) account.password = null;
      const useCase = new ChangePassword(fixture);
      const errorCode =
        state === "존재하지 않는"
          ? ErrorCode.USER_0601
          : state === "탈퇴한"
            ? ErrorCode.USER_0606
            : ErrorCode.USER_0613;

      // When
      const pending = useCase.execute({
        userId: fixture.user.id,
        currentPassword: AUTH_CREDENTIAL_PASSWORD,
        newPassword,
      });

      // Then
      await expect(pending).rejects.toMatchObject({ errorCode });
      expect(fixture.passwordService.hashes).toEqual([]);
      expect(fixture.securityLogRepository.entries).toEqual([]);
    },
  );

  it("현재 비밀번호가 틀리면 비밀번호·세션·캐시를 유지한다", async () => {
    // Given
    const fixture = createAuthCredentialFixture();
    const useCase = new ChangePassword(fixture);
    const session = SessionFixture.create({ userId: fixture.user.id });
    fixture.sessionRepository.sessions.set(session.id, session);
    fixture.cacheService.sessionIds.add(session.id);

    // When
    const pending = useCase.execute({
      userId: fixture.user.id,
      currentPassword: "WrongPassword!",
      newPassword,
    });

    // Then
    await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.USER_0602 });
    expect(
      await fixture.accountRepository.findByUserIdAndProvider(fixture.user.id, "CREDENTIAL"),
    ).toMatchObject({ password: `digest:${AUTH_CREDENTIAL_PASSWORD}` });
    expect(fixture.passwordService.hashes).toEqual([]);
    expect(fixture.sessionRepository.sessions.get(session.id)?.revokedAt).toBeNull();
    expect(fixture.cacheService.sessionIds.has(session.id)).toBe(true);
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });
});
