import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import {
  AUTH_CREDENTIAL_TIME,
  AUTH_CREDENTIAL_PASSWORD,
  createAuthCredentialFixture,
} from "#test/fixtures/auth-credential.fixture";

import { ChangePassword } from "./change-password.use-case.js";
import { LoginWithPassword } from "./login-with-password.use-case.js";

describe("LoginWithPassword — 이메일 로그인과 계정 보호", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AUTH_CREDENTIAL_TIME);
  });
  afterEach(() => vi.useRealTimers());

  function given(options: Parameters<typeof createAuthCredentialFixture>[0] = {}) {
    const fixture = createAuthCredentialFixture(options);
    const useCase = new LoginWithPassword({
      userRepository: fixture.userRepository,
      accountRepository: fixture.accountRepository,
      loginAttemptRepository: fixture.loginAttemptRepository,
      passwordService: fixture.passwordService,
      securityLogRepository: fixture.securityLogRepository,
      issueLoginUseCase: fixture.issueLoginUseCase,
      restoreAccount: fixture.restoreAccount,
      cacheService: fixture.cacheService,
      unitOfWork: fixture.unitOfWork,
      logger: fixture.logger,
    });
    return { ...fixture, useCase };
  }

  it("인증된 사용자의 세션·토큰을 발급하고 성공 기록과 프로필을 반환한다", async () => {
    // Given
    const fixture = given();
    const metadata = { ip: "192.0.2.1", userAgent: "Aido-Test" };
    // When
    const result = await fixture.useCase.execute({
      email: fixture.user.email,
      password: AUTH_CREDENTIAL_PASSWORD,
      deviceName: "내 기기",
      metadata,
    });
    // Then
    expect(result).toMatchObject({
      userId: fixture.user.id,
      userTag: fixture.user.userTag,
      name: "사용자",
      profileImage: null,
      accountRestored: false,
      tokens: { expiresIn: 900 },
    });
    expect(fixture.sessionRepository.sessions.has(result.sessionId)).toBe(true);
    expect(fixture.sessionRepository.creations).toEqual([
      expect.objectContaining({
        deviceFingerprint: "내 기기",
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
      }),
    ]);
    expect(fixture.loginAttemptRepository.attempts).toEqual([
      expect.objectContaining({ email: fixture.user.email, provider: "CREDENTIAL", success: true }),
    ]);
    expect(fixture.securityLogRepository.entries).toEqual([
      {
        userId: fixture.user.id,
        event: "LOGIN_SUCCESS",
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
      },
    ]);
  });

  it.each(["missing", "social", "wrong"] as const)(
    "%s 자격 증명 실패의 사유를 저장하고 세션을 발급하지 않는다",
    async (reason) => {
      // Given
      const fixture = given({ empty: reason === "missing", socialOnly: reason === "social" });
      const expected =
        reason === "missing"
          ? "USER_NOT_FOUND"
          : reason === "social"
            ? "NO_CREDENTIAL_ACCOUNT"
            : "INVALID_PASSWORD";
      // When
      const pending = fixture.useCase.execute({
        email: fixture.user.email,
        password: reason === "wrong" ? "wrong" : AUTH_CREDENTIAL_PASSWORD,
      });
      // Then
      await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.USER_0602 });
      expect(fixture.loginAttemptRepository.attempts).toEqual([
        expect.objectContaining({ success: false, failureReason: expected }),
      ]);
      expect(fixture.sessionRepository.sessions.size).toBe(0);
    },
  );

  it("다섯 번째 비밀번호 실패부터 잠그고 30분이 지난 실패는 잠금 계산에서 제외한다", async () => {
    // Given
    const fixture = given();
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      // When / Then
      await expect(
        fixture.useCase.execute({ email: fixture.user.email, password: "wrong" }),
      ).rejects.toMatchObject({
        errorCode: attempt === 5 ? ErrorCode.USER_0607 : ErrorCode.USER_0602,
      });
    }
    await expect(
      fixture.useCase.execute({ email: fixture.user.email, password: AUTH_CREDENTIAL_PASSWORD }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.USER_0607 });
    expect(fixture.loginAttemptRepository.attempts).toHaveLength(5);
    expect(fixture.passwordService.checked).toHaveLength(5);
    expect(fixture.securityLogRepository.entries).toEqual([
      expect.objectContaining({
        event: "ACCOUNT_LOCKED",
        metadata: { email: fixture.user.email, recentFailures: 5 },
      }),
    ]);
    vi.setSystemTime(new Date(AUTH_CREDENTIAL_TIME.getTime() + 31 * 60_000));
    const result = await fixture.useCase.execute({
      email: fixture.user.email,
      password: AUTH_CREDENTIAL_PASSWORD,
    });
    expect(result.accountRestored).toBe(false);
    expect(fixture.loginAttemptRepository.attempts.at(-1)?.success).toBe(true);
  });

  it.each([
    { status: "PENDING_VERIFY", errorCode: ErrorCode.EMAIL_0503 },
    { status: "LOCKED", errorCode: ErrorCode.USER_0607 },
    { status: "SUSPENDED", errorCode: ErrorCode.USER_0605 },
  ] as const)(
    "$status 계정은 올바른 비밀번호여도 세션을 발급하지 않는다",
    async ({ status, errorCode }) => {
      // Given
      const fixture = given({ pending: status === "PENDING_VERIFY" });
      fixture.userRepository.users.set(fixture.user.id, { ...fixture.user, status });
      // When
      const pending = fixture.useCase.execute({
        email: fixture.user.email,
        password: AUTH_CREDENTIAL_PASSWORD,
      });
      // Then
      await expect(pending).rejects.toMatchObject({ errorCode });
      expect(fixture.sessionRepository.sessions.size).toBe(0);
      expect(fixture.loginAttemptRepository.attempts).toEqual([]);
    },
  );

  it.each([false, true])(
    "복구 승인 후 처리 중 유예 경계 통과=%s여도 같은 판정 시각으로 복구한다",
    async (crossesBoundary) => {
      // Given
      const fixture = given();
      const deletedAt = new Date(
        AUTH_CREDENTIAL_TIME.getTime() - (crossesBoundary ? 30 * 86_400_000 - 1 : 29 * 86_400_000),
      );
      await fixture.userRepository.softDelete(fixture.user.id, deletedAt);
      fixture.cacheService.userIds.add(fixture.user.id);
      if (crossesBoundary)
        fixture.unitOfWork.run = async <T>(work: () => Promise<T>): Promise<T> => {
          vi.setSystemTime(new Date(AUTH_CREDENTIAL_TIME.getTime() + 2));
          return work();
        };
      // When
      const result = await fixture.useCase.execute({
        email: fixture.user.email,
        password: AUTH_CREDENTIAL_PASSWORD,
      });
      // Then
      expect(result.accountRestored).toBe(true);
      expect(fixture.userRepository.users.get(fixture.user.id)).toMatchObject({
        status: "ACTIVE",
        deletedAt: null,
      });
      expect(fixture.cacheService.userIds.has(fixture.user.id)).toBe(false);
      expect(fixture.securityLogRepository.entries).toContainEqual(
        expect.objectContaining({
          event: "ACCOUNT_RESTORED",
          metadata: {
            deletedAt: deletedAt.toISOString(),
            restoredAt: AUTH_CREDENTIAL_TIME.toISOString(),
          },
        }),
      );
    },
  );

  it("복구 유예가 끝난 계정은 저장·발급 없이 USER_0606으로 거부한다", async () => {
    // Given
    const fixture = given();
    await fixture.userRepository.softDelete(
      fixture.user.id,
      new Date(AUTH_CREDENTIAL_TIME.getTime() - 31 * 86_400_000),
    );
    // When
    const pending = fixture.useCase.execute({
      email: fixture.user.email,
      password: AUTH_CREDENTIAL_PASSWORD,
    });
    // Then
    await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.USER_0606 });
    expect(fixture.sessionRepository.sessions.size).toBe(0);
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });

  it("진행 중인 rehash보다 뒤에 변경한 비밀번호를 CAS로 보존한다", async () => {
    // Given
    const fixture = given();
    const pendingHash = Promise.withResolvers<string>();
    const finished = Promise.withResolvers<void>();
    fixture.passwordService.outdatedHashes.add(`digest:${AUTH_CREDENTIAL_PASSWORD}`);
    vi.spyOn(fixture.passwordService, "hash").mockReturnValueOnce(pendingHash.promise);
    const update = fixture.accountRepository.updatePasswordIfUnchanged.bind(
      fixture.accountRepository,
    );
    vi.spyOn(fixture.accountRepository, "updatePasswordIfUnchanged").mockImplementation(
      async (...input) => {
        const result = await update(...input);
        finished.resolve();
        return result;
      },
    );
    // When
    const result = await fixture.useCase.execute({
      email: fixture.user.email,
      password: AUTH_CREDENTIAL_PASSWORD,
    });
    const changePassword = new ChangePassword({
      userRepository: fixture.userRepository,
      accountRepository: fixture.accountRepository,
      passwordService: fixture.passwordService,
      sessionRepository: fixture.sessionRepository,
      cacheService: fixture.cacheService,
      securityLogRepository: fixture.securityLogRepository,
      unitOfWork: fixture.unitOfWork,
      logger: fixture.logger,
    });
    await changePassword.execute({
      userId: fixture.user.id,
      currentPassword: AUTH_CREDENTIAL_PASSWORD,
      newPassword: "new-password",
      currentSessionId: result.sessionId,
    });
    pendingHash.resolve("upgraded:old-password");
    await finished.promise;
    // Then
    expect(fixture.sessionRepository.sessions.has(result.sessionId)).toBe(true);
    expect(fixture.accountRepository.accounts[0]?.password).toBe("digest:new-password");
    expect(fixture.logger.debug).not.toHaveBeenCalled();
  });

  it("rehash 실패는 성공한 로그인 응답을 바꾸거나 민감한 오류를 기록하지 않는다", async () => {
    // Given
    const fixture = given();
    const pendingHash = Promise.withResolvers<string>();
    const logged = Promise.withResolvers<void>();
    fixture.passwordService.outdatedHashes.add(`digest:${AUTH_CREDENTIAL_PASSWORD}`);
    vi.spyOn(fixture.passwordService, "hash").mockReturnValueOnce(pendingHash.promise);
    fixture.logger.error.mockImplementation(() => {
      logged.resolve();
    });
    // When
    const result = await fixture.useCase.execute({
      email: fixture.user.email,
      password: AUTH_CREDENTIAL_PASSWORD,
    });
    pendingHash.reject(new Error("private password payload"));
    await logged.promise;
    // Then
    expect(fixture.sessionRepository.sessions.has(result.sessionId)).toBe(true);
    expect(fixture.accountRepository.accounts[0]?.password).toBe(
      `digest:${AUTH_CREDENTIAL_PASSWORD}`,
    );
    expect(JSON.stringify(fixture.logger.error.mock.calls)).not.toContain(
      "private password payload",
    );
  });

  it("비밀번호가 그대로면 rehash를 저장하고 로그인 세션을 유지한다", async () => {
    // Given
    const fixture = given();
    const pendingHash = Promise.withResolvers<string>();
    const logged = Promise.withResolvers<void>();
    fixture.passwordService.outdatedHashes.add(`digest:${AUTH_CREDENTIAL_PASSWORD}`);
    vi.spyOn(fixture.passwordService, "hash").mockReturnValueOnce(pendingHash.promise);
    fixture.logger.debug.mockImplementation(() => {
      logged.resolve();
    });
    // When
    const result = await fixture.useCase.execute({
      email: fixture.user.email,
      password: AUTH_CREDENTIAL_PASSWORD,
    });
    pendingHash.resolve("upgraded:current-password");
    await logged.promise;
    // Then
    expect(fixture.accountRepository.accounts[0]?.password).toBe("upgraded:current-password");
    expect(fixture.sessionRepository.sessions.get(result.sessionId)?.revokedAt).toBeNull();
    expect(fixture.logger.error).not.toHaveBeenCalled();
  });
});
