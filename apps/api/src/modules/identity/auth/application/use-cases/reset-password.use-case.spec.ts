import { ErrorCode } from "@aido/api/errors";
import { REVOKE_REASON, SECURITY_EVENT } from "@aido/api/vocabulary";

import { AUTH_DEFAULTS } from "#api/modules/identity/auth/domain/auth.constants";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  AUTH_CREDENTIAL_NOW,
  AUTH_CREDENTIAL_PASSWORD,
  createAuthCredentialFixture,
} from "#test/fixtures/auth-credential.fixture";
import { createAuthVerificationFixture } from "#test/fixtures/identity/auth-credential.fixture";
import {
  createAuthSessionFixture,
  createIdentityUserFixture,
} from "#test/fixtures/identity/auth-session.fixture";

import { ResetPasswordUseCase } from "./reset-password.use-case.js";

describe("ResetPassword — 코드 소비와 모든 기기의 세션 폐기", () => {
  const code = "123456";
  const newPassword = "NewPassword2!";

  async function given(options: Parameters<typeof createAuthCredentialFixture>[0] = {}) {
    const fixture = createAuthCredentialFixture(options);
    await fixture.verificationRepository.save(
      createAuthVerificationFixture({
        userId: fixture.user.id,
        type: "PASSWORD_RESET",
        tokenHash: fixture.verificationCodeSecurity.hash(code),
      }),
    );
    return { ...fixture, useCase: new ResetPasswordUseCase(fixture) };
  }

  it("코드를 한 번 소비하고 모든 기기의 실제 폐기 세션 캐시와 비밀번호를 갱신한다", async () => {
    // Given
    const fixture = await given();
    const sessions = [
      createAuthSessionFixture({ id: "first-device", userId: fixture.user.id }),
      createAuthSessionFixture({
        id: "expired-device",
        userId: fixture.user.id,
        expiresAt: AUTH_CREDENTIAL_NOW.subtract({ hours: 1 }),
      }),
    ];
    const otherUserSession = createAuthSessionFixture({
      id: "other-user-device",
      userId: "other-user",
    });
    for (const session of [...sessions, otherUserSession]) {
      await fixture.sessionRepository.save(session);
      fixture.cacheService.sessionIds.add(session.id.value);
    }

    // When
    const result = await fixture.useCase.execute({ email: fixture.user.email, code, newPassword });

    // Then
    expect(result.message).toBe("비밀번호가 재설정되었습니다. 다시 로그인해주세요.");
    expect(
      await fixture.accountRepository.findByUserIdAndProvider(
        UserId.reconstitute(fixture.user.id),
        "CREDENTIAL",
      ),
    ).toMatchObject({ password: `digest:${newPassword}` });
    expect(fixture.verificationRepository.all).toEqual([
      expect.objectContaining({ usedAt: AUTH_CREDENTIAL_NOW }),
    ]);
    for (const session of sessions) {
      expect(fixture.sessionRepository.stored(session.id.value)?.revokedAt).toEqual(
        AUTH_CREDENTIAL_NOW,
      );
      expect(fixture.sessionRepository.revocationReasons.get(session.id.value)).toBe(
        REVOKE_REASON.PASSWORD_RESET,
      );
      expect(fixture.cacheService.sessionIds.has(session.id.value)).toBe(false);
    }
    expect(fixture.pushDevices.releasedSessionIds).toEqual(["first-device", "expired-device"]);
    expect(fixture.sessionRepository.stored(otherUserSession.id.value)?.revokedAt).toBeNull();
    expect(fixture.cacheService.sessionIds.has(otherUserSession.id.value)).toBe(true);
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
      const fixture = await given({
        empty: state === "존재하지 않는",
        socialOnly: state === "소셜 전용",
      });
      if (state === "탈퇴한") {
        const user = createIdentityUserFixture(fixture.user);
        user.requestDeletion(AUTH_CREDENTIAL_NOW);
        await fixture.userRepository.saveAccountStatus(user);
      }
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
      expect(fixture.verificationRepository.all).toEqual([
        expect.objectContaining({ attempts: 0, usedAt: null }),
      ]);
    },
  );

  it("잘못된 코드는 실패 횟수만 증가시키고 비밀번호·세션·캐시를 유지한다", async () => {
    // Given
    const fixture = await given();
    const session = createAuthSessionFixture({ userId: fixture.user.id });
    await fixture.sessionRepository.save(session);
    fixture.cacheService.sessionIds.add(session.id.value);

    // When
    const pending = fixture.useCase.execute({
      email: fixture.user.email,
      code: "000000",
      newPassword,
    });

    // Then
    await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.VERIFY_0751 });
    expect(
      await fixture.accountRepository.findByUserIdAndProvider(
        UserId.reconstitute(fixture.user.id),
        "CREDENTIAL",
      ),
    ).toMatchObject({ password: `digest:${AUTH_CREDENTIAL_PASSWORD}` });
    expect(fixture.verificationRepository.all).toEqual([
      expect.objectContaining({ attempts: 1, usedAt: null }),
    ]);
    expect(fixture.sessionRepository.stored(session.id.value)?.revokedAt).toBeNull();
    expect(fixture.cacheService.sessionIds.has(session.id.value)).toBe(true);
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });

  it("이미 소비한 코드로 다시 요청하면 첫 변경 결과와 감사 기록을 유지한다", async () => {
    // Given
    const fixture = await given();
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
      await fixture.accountRepository.findByUserIdAndProvider(
        UserId.reconstitute(fixture.user.id),
        "CREDENTIAL",
      ),
    ).toMatchObject({ password: `digest:${newPassword}` });
    expect(fixture.securityLogRepository.entries).toHaveLength(1);
  });
});
