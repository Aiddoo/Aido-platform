import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import { SECURITY_EVENT } from "#api/modules/identity/domain/constants/auth/auth.constants";
import {
  AUTH_CREDENTIAL_TIME,
  createAuthCredentialFixture,
} from "#test/fixtures/auth-credential.fixture";
import { SessionFixture, VerificationFixture } from "#test/fixtures/session.fixture";

import { GetCurrentUser } from "./get-current-user.use-case.js";
import { SetPassword } from "./set-password.use-case.js";

describe("SetPassword — 소셜 세션을 유지하는 Credential 계정 추가", () => {
  const code = "123456";
  const newPassword = "NewPassword2!";
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AUTH_CREDENTIAL_TIME);
  });
  afterEach(() => vi.useRealTimers());

  function given(options: Parameters<typeof createAuthCredentialFixture>[0] = {}) {
    const fixture = createAuthCredentialFixture({ socialOnly: true, ...options });
    const verification = VerificationFixture.create({
      userId: fixture.user.id,
      type: "PASSWORD_SETUP",
      token: fixture.verificationCodeSecurity.hash(code),
    });
    fixture.verificationRepository.verifications.set(verification.id, verification);
    return { ...fixture, verification, useCase: new SetPassword(fixture) };
  }

  it("설정 코드를 소비해 Credential 계정을 추가하고 기존 세션·최신 프로필을 유지한다", async () => {
    // Given
    const fixture = given();
    const session = SessionFixture.create({ userId: fixture.user.id });
    fixture.sessionRepository.sessions.set(session.id, session);
    fixture.cacheService.sessionIds.add(session.id);
    const currentUser = new GetCurrentUser(fixture);
    expect(
      (await currentUser.execute({ userId: fixture.user.id, sessionId: session.id })).providers,
    ).toEqual(["GOOGLE"]);
    const metadata = { ip: "192.0.2.12", userAgent: "소셜 로그인 기기" };

    // When
    const result = await fixture.useCase.execute({
      userId: fixture.user.id,
      code,
      newPassword,
      metadata,
    });

    // Then
    expect(result.message).toBe("비밀번호가 설정되었습니다. 이제 이메일로 로그인할 수 있습니다.");
    expect(
      await fixture.accountRepository.findByUserIdAndProvider(fixture.user.id, "CREDENTIAL"),
    ).toMatchObject({ password: `digest:${newPassword}` });
    expect(
      fixture.verificationRepository.verifications.get(fixture.verification.id)?.usedAt,
    ).toEqual(AUTH_CREDENTIAL_TIME);
    expect(fixture.sessionRepository.sessions.get(session.id)?.revokedAt).toBeNull();
    expect(fixture.cacheService.sessionIds.has(session.id)).toBe(true);
    expect(
      (await currentUser.execute({ userId: fixture.user.id, sessionId: session.id })).providers,
    ).toEqual(["GOOGLE", "CREDENTIAL"]);
    expect(fixture.securityLogRepository.entries).toEqual([
      {
        userId: fixture.user.id,
        event: SECURITY_EVENT.PASSWORD_SETUP,
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
      },
    ]);
  });

  it.each(["존재하지 않는", "탈퇴한", "이미 비밀번호가 있는"] as const)(
    "%s 사용자는 코드 소비와 계정 추가 이전에 거부한다",
    async (state) => {
      // Given
      const fixture = given({
        empty: state === "존재하지 않는",
        socialOnly: state !== "이미 비밀번호가 있는",
      });
      if (state === "탈퇴한")
        await fixture.userRepository.softDelete(fixture.user.id, AUTH_CREDENTIAL_TIME);
      const errorCode =
        state === "존재하지 않는"
          ? ErrorCode.USER_0601
          : state === "탈퇴한"
            ? ErrorCode.USER_0606
            : ErrorCode.USER_0614;

      // When
      const pending = fixture.useCase.execute({ userId: fixture.user.id, code, newPassword });

      // Then
      await expect(pending).rejects.toMatchObject({ errorCode });
      expect(
        fixture.verificationRepository.verifications.get(fixture.verification.id)?.usedAt,
      ).toBeNull();
      expect(fixture.passwordService.hashes).toEqual([]);
      expect(fixture.securityLogRepository.entries).toEqual([]);
    },
  );

  it("다른 용도의 올바른 코드로는 Credential 계정을 추가하지 못한다", async () => {
    // Given
    const fixture = given();
    fixture.verificationRepository.verifications.set(fixture.verification.id, {
      ...fixture.verification,
      type: "PASSWORD_RESET",
    });

    // When
    const pending = fixture.useCase.execute({ userId: fixture.user.id, code, newPassword });

    // Then
    await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.VERIFY_0751 });
    expect(
      await fixture.accountRepository.findByUserIdAndProvider(fixture.user.id, "CREDENTIAL"),
    ).toBeNull();
    expect(
      fixture.verificationRepository.verifications.get(fixture.verification.id)?.usedAt,
    ).toBeNull();
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });

  it("잘못된 설정 코드는 실패 횟수를 증가시키고 프로필 캐시를 유지한다", async () => {
    // Given
    const fixture = given();
    fixture.cacheService.userIds.add(fixture.user.id);

    // When
    const pending = fixture.useCase.execute({
      userId: fixture.user.id,
      code: "000000",
      newPassword,
    });

    // Then
    await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.VERIFY_0751 });
    expect(fixture.verificationRepository.verifications.get(fixture.verification.id)).toMatchObject(
      { attempts: 1, usedAt: null },
    );
    expect(
      await fixture.accountRepository.findByUserIdAndProvider(fixture.user.id, "CREDENTIAL"),
    ).toBeNull();
    expect(fixture.cacheService.userIds.has(fixture.user.id)).toBe(true);
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });
});
