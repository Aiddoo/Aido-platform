import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import {
  AUTH_CREDENTIAL_TIME,
  AUTH_CREDENTIAL_PASSWORD,
  createAuthCredentialFixture,
} from "#test/fixtures/auth-credential.fixture";

import { AuthPersistenceConflict } from "../../ports/auth/auth-persistence.port.js";
import { Register } from "./register.use-case.js";

describe("Register — 이메일 계정 등록", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AUTH_CREDENTIAL_TIME);
  });
  afterEach(() => vi.useRealTimers());

  function given(options: Parameters<typeof createAuthCredentialFixture>[0] = {}) {
    const fixture = createAuthCredentialFixture(options);
    const useCase = new Register({
      userRepository: fixture.userRepository,
      passwordService: fixture.passwordService,
      provisionUserUseCase: fixture.provisionUserUseCase,
      verificationService: fixture.verificationService,
      securityLogRepository: fixture.securityLogRepository,
      unitOfWork: fixture.unitOfWork,
      adminEventNotifier: fixture.adminEventNotifier,
      logger: fixture.logger,
    });
    return { ...fixture, useCase };
  }

  const input = {
    email: "new@example.com",
    password: AUTH_CREDENTIAL_PASSWORD,
    passwordConfirm: AUTH_CREDENTIAL_PASSWORD,
    name: "신규 사용자",
    termsAgreed: true,
    privacyAgreed: true,
    marketingAgreed: false,
    marketingPushAgreed: false,
  } satisfies Parameters<Register["execute"]>[0];

  it("미인증 계정·프로필·동의를 저장하고 인증 메일과 등록 알림을 발송한다", async () => {
    // Given
    const fixture = given({ empty: true });
    const metadata = { ip: "192.0.2.1", userAgent: "Aido-Test" };
    // When
    const result = await fixture.useCase.execute({ ...input, metadata });
    // Then
    expect(result).toMatchObject({ email: input.email, emailSent: true });
    expect(fixture.userRepository.users.get(result.userId)).toMatchObject({
      status: "PENDING_VERIFY",
      emailVerifiedAt: null,
    });
    expect(fixture.accountRepository.accounts).toEqual([
      expect.objectContaining({
        userId: result.userId,
        provider: "CREDENTIAL",
        password: `digest:${input.password}`,
      }),
    ]);
    expect(fixture.userRepository.profiles.get(result.userId)).toEqual({
      name: input.name,
      profileImage: null,
    });
    expect(fixture.seeder.settings).toEqual([
      {
        userId: result.userId,
        consent: {
          termsAgreedAt: AUTH_CREDENTIAL_TIME,
          privacyAgreedAt: AUTH_CREDENTIAL_TIME,
          marketingAgreedAt: undefined,
          marketingPushAgreedAt: undefined,
        },
      },
    ]);
    expect(fixture.seeder.categoryUserIds).toEqual([result.userId]);
    expect(fixture.retentionEnroller.enrollments).toEqual([
      { userId: result.userId, activated: false },
    ]);
    expect(fixture.emailSender.getLastCode(input.email)).toBe("123456");
    expect([...fixture.verificationRepository.verifications.values()]).toEqual([
      expect.objectContaining({
        userId: result.userId,
        token: "digest:123456",
        type: "EMAIL_VERIFY",
      }),
    ]);
    expect(fixture.securityLogRepository.entries).toEqual([
      {
        userId: result.userId,
        event: "REGISTRATION",
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
      },
    ]);
    expect(fixture.adminEventNotifier.notifications).toEqual([
      {
        userId: result.userId,
        email: input.email,
        provider: "credential",
        registeredAt: AUTH_CREDENTIAL_TIME.toISOString(),
      },
    ]);
    const logs = JSON.stringify(fixture.logger.log.mock.calls);
    expect(logs).not.toContain(input.email);
    expect(logs).not.toContain(input.password);
  });

  it("이미 등록한 이메일은 해시·저장·발송 없이 거부한다", async () => {
    // Given
    const fixture = given();
    // When
    const pending = fixture.useCase.execute({ ...input, email: fixture.user.email });
    // Then
    await expect(pending).rejects.toMatchObject({
      errorCode: ErrorCode.EMAIL_0501,
      details: { email: fixture.user.email },
    });
    expect(fixture.passwordService.hashes).toEqual([]);
    expect(fixture.emailSender.getSentCount()).toBe(0);
    expect(fixture.userRepository.users.size).toBe(1);
  });

  it.each([true, false])(
    "저장소 충돌의 이메일 중복 여부=%s에 따라 오류를 정규화한다",
    async (emailConflict) => {
      // Given
      const fixture = given({ empty: true });
      const error = emailConflict
        ? new AuthPersistenceConflict("EMAIL_ALREADY_EXISTS")
        : new Error("other storage failure");
      fixture.unitOfWork.run = async () => {
        throw error;
      };
      // When
      const pending = fixture.useCase.execute(input);
      // Then
      if (emailConflict)
        await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.EMAIL_0501 });
      else await expect(pending).rejects.toBe(error);
      expect(fixture.emailSender.getSentCount()).toBe(0);
      expect(fixture.adminEventNotifier.notifications).toEqual([]);
    },
  );

  it("메일 발송 예외가 나도 저장한 가입을 유지하고 재발송 안내를 반환한다", async () => {
    // Given
    const fixture = given({ empty: true });
    vi.spyOn(fixture.verificationService, "sendVerificationEmail").mockRejectedValueOnce(
      new Error("private SMTP detail"),
    );
    // When
    const result = await fixture.useCase.execute(input);
    // Then
    expect(result.emailSent).toBe(false);
    expect(result.message).toContain("재발송");
    expect(fixture.userRepository.users.has(result.userId)).toBe(true);
    expect(fixture.adminEventNotifier.notifications).toHaveLength(1);
    expect(JSON.stringify(fixture.logger.error.mock.calls)).not.toContain("private SMTP detail");
  });
});
