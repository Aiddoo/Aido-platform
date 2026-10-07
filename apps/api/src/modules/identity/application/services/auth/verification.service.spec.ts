import { ErrorCode } from "@aido/api/errors";
import { VERIFICATION_CODE } from "@aido/api/vocabulary";
import { vi, type Mocked } from "vitest";
import { mock } from "vitest-mock-extended";

import type { VerificationType } from "#api/modules/identity/domain/types/auth/auth.types";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { VerificationFixture } from "#test/fixtures/index";
import { FakeEmailService } from "#test/mocks/fake-email.service";

import { IdentityLogEvent } from "../../observability/auth/identity-log.events.js";
import type { AuthVerificationRepositoryPort } from "../../ports/auth/auth-persistence.port.js";
import type { VerificationCodeSecurityPort } from "../../ports/auth/verification-code-security.port.js";
import { VerificationService } from "./verification.service.js";

const currentTime = new Date("2026-12-31T23:59:00Z");
const expiresAt = new Date("2027-01-01T00:09:00Z");
const cooldownSince = new Date("2026-12-31T23:58:00Z");
const userId = "user-123";
const email = "test@example.com";
const code = "123456";
const digest = "hashed-token";
const passwordScenarios = [
  { method: "createAndSendPasswordReset", type: "PASSWORD_RESET", emailType: "password-reset" },
  { method: "createAndSendPasswordSetup", type: "PASSWORD_SETUP", emailType: "password-setup" },
] as const;

describe("VerificationService — 인증 코드 발급과 계정 보호", () => {
  let service: VerificationService;
  let logger: Mocked<ApplicationLogger>;
  let repository: Mocked<AuthVerificationRepositoryPort>;
  let emailSender: FakeEmailService;
  let security: Mocked<VerificationCodeSecurityPort>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(currentTime);
    logger = mock<ApplicationLogger>();
    repository = mock<AuthVerificationRepositoryPort>();
    security = mock<VerificationCodeSecurityPort>();
    emailSender = new FakeEmailService();
    service = new VerificationService({
      logger,
      verificationRepository: repository,
      verificationCodeSecurity: security,
      emailSender,
    });
    security.generate.mockReturnValue({ plaintext: code, digest });
    vi.when(security.hash, { onUnmatched: "throw" })
      .calledWith(code)
      .thenReturn(digest)
      .calledWith("999999")
      .thenReturn("wrong-hash");
  });

  afterEach(() => vi.useRealTimers());

  describe.each(passwordScenarios)("$type 발급", ({ method, type, emailType }) => {
    beforeEach(() => {
      vi.when(repository.countRecentByUserIdAndType, { onUnmatched: "throw" })
        .calledWith(userId, type, cooldownSince)
        .thenResolve(0);
      repository.invalidateAllByUserIdAndType.mockResolvedValue(0);
      repository.create.mockResolvedValue(
        VerificationFixture.create({ userId, type, token: digest, expiresAt }),
      );
    });

    it("이전 코드를 무효화하고 해시를 저장하며 연말을 넘는 만료 시간과 평문 코드를 발송한다", async () => {
      // Given - 고정된 연말 시간과 사용 가능한 발급 상태

      // When
      const result = await service[method](userId, email);

      // Then
      expect(result).toEqual({ code, expiresAt });
      expect(repository.invalidateAllByUserIdAndType).toHaveBeenCalledWith(userId, type);
      expect(repository.create).toHaveBeenCalledWith({ userId, type, token: digest, expiresAt });
      expect(emailSender.getSentEmail(email)).toEqual(
        expect.objectContaining({
          code,
          type: emailType,
          expiryMinutes: VERIFICATION_CODE.EXPIRY_MINUTES,
          sentAt: currentTime,
        }),
      );
    });

    it("쿨다운 중이면 기존 코드를 무효화하거나 새 코드를 저장·발송하지 않는다", async () => {
      // Given
      vi.when(repository.countRecentByUserIdAndType)
        .calledWith(userId, type, cooldownSince)
        .thenResolve(1);

      // When
      const pending = service[method](userId, email);

      // Then
      await expect(pending).rejects.toMatchObject({
        errorCode: ErrorCode.VERIFY_0753,
        details: { remainingSeconds: VERIFICATION_CODE.RESEND_COOLDOWN_SECONDS },
      });
      expect(repository.invalidateAllByUserIdAndType).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
      expect(emailSender.getSentCount()).toBe(0);
    });

    it("이메일 공급자가 실패해도 발급 결과는 유지하고 민감정보 없이 실패를 기록한다", async () => {
      // Given
      emailSender.simulateFailures(1);

      // When
      const result = await service[method](userId, email);

      // Then
      expect(result).toEqual({ code, expiresAt });
      expect(emailSender.hasSentTo(email)).toBe(false);
      expect(logger.error).toHaveBeenCalledWith({
        event: IdentityLogEvent.VERIFICATION_EMAIL_FAILED,
        verificationType: type,
        userId,
      });
      const logs = JSON.stringify(logger.error.mock.calls);
      expect(logs).not.toContain(email);
      expect(logs).not.toContain(code);
    });
  });

  describe("인증 코드 확인", () => {
    const type: VerificationType = "EMAIL_VERIFY";
    let verification: ReturnType<typeof VerificationFixture.create>;

    beforeEach(() => {
      verification = VerificationFixture.create({ userId, type, token: digest, expiresAt });
      vi.when(repository.findValidByUserIdAndType, { onUnmatched: "throw" })
        .calledWith(userId, type)
        .thenResolve(verification);
      repository.markAsUsed.mockResolvedValue(verification);
      repository.incrementAttempts.mockResolvedValue(verification);
    });

    it("올바른 코드는 인증에 성공하고 사용 처리한다", async () => {
      // Given - 유효한 인증 코드 fixture

      // When
      const result = await service.verifyCode(userId, code, type);

      // Then
      expect(result).toBe(true);
      expect(repository.markAsUsed).toHaveBeenCalledWith(verification.id);
      expect(repository.incrementAttempts).not.toHaveBeenCalled();
    });

    it("유효한 코드가 없으면 인증을 거부하고 사용 처리하지 않는다", async () => {
      // Given
      vi.when(repository.findValidByUserIdAndType).calledWith(userId, type).thenResolve(null);

      // When
      const pending = service.verifyCode(userId, code, type);

      // Then
      await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.VERIFY_0751 });
      expect(repository.markAsUsed).not.toHaveBeenCalled();
    });

    it("시도 한도를 채웠으면 코드가 일치해도 인증을 거부한다", async () => {
      // Given
      vi.when(repository.findValidByUserIdAndType)
        .calledWith(userId, type)
        .thenResolve(
          VerificationFixture.create({ ...verification, attempts: VERIFICATION_CODE.MAX_ATTEMPTS }),
        );

      // When
      const pending = service.verifyCode(userId, code, type);

      // Then
      await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.VERIFY_0754 });
      expect(repository.markAsUsed).not.toHaveBeenCalled();
      expect(repository.incrementAttempts).not.toHaveBeenCalled();
    });

    it("틀린 코드는 실패 횟수를 증가시키고 사용 처리 없이 인증을 거부한다", async () => {
      // Given
      const wrongCode = "999999";

      // When
      const pending = service.verifyCode(userId, wrongCode, type);

      // Then
      await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.VERIFY_0751 });
      expect(repository.incrementAttempts).toHaveBeenCalledExactlyOnceWith(verification.id);
      expect(repository.markAsUsed).not.toHaveBeenCalled();
    });

    it("비밀번호 재설정 코드도 해당 사용자·용도로 조회하여 검증한다", async () => {
      // Given
      const passwordResetType: VerificationType = "PASSWORD_RESET";
      vi.when(repository.findValidByUserIdAndType)
        .calledWith(userId, passwordResetType)
        .thenResolve(VerificationFixture.create({ ...verification, type: passwordResetType }));

      // When
      const result = await service.verifyCode(userId, code, passwordResetType);

      // Then
      expect(result).toBe(true);
      expect(repository.markAsUsed).toHaveBeenCalledWith(verification.id);
    });
  });
});
