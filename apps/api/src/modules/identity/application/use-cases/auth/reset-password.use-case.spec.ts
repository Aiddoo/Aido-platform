import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import {
  AUTH_DEFAULTS,
  REVOKE_REASON,
  SECURITY_EVENT,
} from "#api/modules/identity/domain/constants/auth/auth.constants";
import {
  AUTH_CREDENTIAL_PASSWORD,
  AUTH_CREDENTIAL_TIME,
  createAuthCredentialFixture,
} from "#test/fixtures/auth-credential.fixture";
import { SessionFixture, VerificationFixture } from "#test/fixtures/session.fixture";

import { ResetPassword } from "./reset-password.use-case.js";

describe("ResetPassword — 코드 소비와 모든 기기의 세션 폐기", () => {
  const code = "123456";
  const newPassword = "NewPassword2!";
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AUTH_CREDENTIAL_TIME);
  });
  afterEach(() => vi.useRealTimers());

  function given(options: Parameters<typeof createAuthCredentialFixture>[0] = {}) {
    const fixture = createAuthCredentialFixture(options);
    const verification = VerificationFixture.create({
      userId: fixture.user.id,
      type: "PASSWORD_RESET",
      token: fixture.verificationCodeSecurity.hash(code),
    });
    fixture.verificationRepository.verifications.set(verification.id, verification);
    return { ...fixture, verification, useCase: new ResetPassword(fixture) };
  }

  it("코드를 한 번 소비하고 모든 기기의 실제 폐기 세션 캐시와 비밀번호를 갱신한다", async () => {
    // Given
    const fixture = given();
    const sessions = [
      SessionFixture.create({ id: "first-device", userId: fixture.user.id }),
      SessionFixture.createExpired({ id: "expired-device", userId: fixture.user.id }),
    ];
    const otherUserSession = SessionFixture.create({
      id: "other-user-device",
      userId: "other-user",
    });
    for (const session of [...sessions, otherUserSession]) {
      fixture.sessionRepository.sessions.set(session.id, session);
      fixture.cacheService.sessionIds.add(session.id);
    }

    // When
    const result = await fixture.useCase.execute({ email: fixture.user.email, code, newPassword });

    // Then
    expect(result.message).toBe("비밀번호가 재설정되었습니다. 다시 로그인해주세요.");
    expect(
      await fixture.accountRepository.findByUserIdAndProvider(fixture.user.id, "CREDENTIAL"),
    ).toMatchObject({ password: `digest:${newPassword}` });
    expect(
      fixture.verificationRepository.verifications.get(fixture.verification.id)?.usedAt,
    ).toEqual(AUTH_CREDENTIAL_TIME);
    for (const session of sessions) {
      expect(fixture.sessionRepository.sessions.get(session.id)?.revokedAt).toEqual(
        AUTH_CREDENTIAL_TIME,
      );
      expect(fixture.sessionRepository.revocationReasons.get(session.id)).toBe(
        REVOKE_REASON.PASSWORD_RESET,
      );
      expect(fixture.cacheService.sessionIds.has(session.id)).toBe(false);
    }
    expect(fixture.sessionRepository.sessions.get(otherUserSession.id)?.revokedAt).toBeNull();
    expect(fixture.cacheService.sessionIds.has(otherUserSession.id)).toBe(true);
    expect(fixture.securityLogRepository.entries).toEqual([
      {
        userId: fixture.user.id,
        event: SECURITY_EVENT.PASSWORD_CHANGED,
        ipAddress: AUTH_DEFAULTS.UNKNOWN_IP,
        userAgent: AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
        metadata: { email: fixture.user.email, reason: REVOKE_REASON.PASSWORD_RESET },
      },
    ]);
  });

  it.each(["존재하지 않는", "탈퇴한", "소셜 전용"] as const)(
    "%s 사용자는 비밀번호와 세션을 변경하지 못한다",
    async (state) => {
      // Given
      const fixture = given({
        empty: state === "존재하지 않는",
        socialOnly: state === "소셜 전용",
      });
      if (state === "탈퇴한")
        await fixture.userRepository.softDelete(fixture.user.id, AUTH_CREDENTIAL_TIME);
      const errorCode =
        state === "존재하지 않는"
          ? ErrorCode.VERIFY_0751
          : state === "탈퇴한"
            ? ErrorCode.USER_0606
            : ErrorCode.USER_0613;

      // When
      const pending = fixture.useCase.execute({ email: fixture.user.email, code, newPassword });

      // Then
      await expect(pending).rejects.toMatchObject({ errorCode });
      expect(fixture.passwordService.hashes).toEqual([]);
      expect(fixture.securityLogRepository.entries).toEqual([]);
      expect(
        fixture.verificationRepository.verifications.get(fixture.verification.id)?.usedAt,
      ).toBeNull();
    },
  );

  it("잘못된 코드는 실패 횟수만 증가시키고 비밀번호·세션·캐시를 유지한다", async () => {
    // Given
    const fixture = given();
    const session = SessionFixture.create({ userId: fixture.user.id });
    fixture.sessionRepository.sessions.set(session.id, session);
    fixture.cacheService.sessionIds.add(session.id);

    // When
    const pending = fixture.useCase.execute({
      email: fixture.user.email,
      code: "000000",
      newPassword,
    });

    // Then
    await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.VERIFY_0751 });
    expect(
      await fixture.accountRepository.findByUserIdAndProvider(fixture.user.id, "CREDENTIAL"),
    ).toMatchObject({ password: `digest:${AUTH_CREDENTIAL_PASSWORD}` });
    expect(fixture.verificationRepository.verifications.get(fixture.verification.id)).toMatchObject(
      { attempts: 1, usedAt: null },
    );
    expect(fixture.sessionRepository.sessions.get(session.id)?.revokedAt).toBeNull();
    expect(fixture.cacheService.sessionIds.has(session.id)).toBe(true);
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });

  it("이미 소비한 코드로 다시 요청하면 첫 변경 결과와 감사 기록을 유지한다", async () => {
    // Given
    const fixture = given();
    await fixture.useCase.execute({ email: fixture.user.email, code, newPassword });

    // When
    const pending = fixture.useCase.execute({
      email: fixture.user.email,
      code,
      newPassword: "AnotherPassword3!",
    });

    // Then
    await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.VERIFY_0751 });
    expect(
      await fixture.accountRepository.findByUserIdAndProvider(fixture.user.id, "CREDENTIAL"),
    ).toMatchObject({ password: `digest:${newPassword}` });
    expect(fixture.securityLogRepository.entries).toHaveLength(1);
  });
});
