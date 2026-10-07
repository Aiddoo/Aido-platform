import { ErrorCode } from "@aido/api/errors";
import { VERIFICATION_CODE } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import { AuthVerification } from "#api/modules/identity/domain/aggregates/auth/auth-verification.aggregate";
import type { VerificationType } from "#api/modules/identity/domain/types/auth/auth.types";
import { VerificationCode } from "#api/modules/identity/domain/value-objects/auth/verification-code.vo";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { addMinutes, subtractSeconds } from "#api/shared/domain/date/utils/arithmetic";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { IdentityLogEvent } from "../../observability/auth/identity-log.events.js";
import { type AuthEmailSenderPort } from "../../ports/auth/auth-collaboration.port.js";
import { type AuthVerificationRepositoryPort } from "../../ports/auth/auth-persistence.port.js";
import { type VerificationCodeSecurityPort } from "../../ports/auth/verification-code-security.port.js";

export interface VerificationCodeResult {
  code: string;
  expiresAt: Date;
}

interface VerificationServiceDependencies {
  readonly verificationRepository: AuthVerificationRepositoryPort;
  readonly emailSender: AuthEmailSenderPort;
  readonly verificationCodeSecurity: VerificationCodeSecurityPort;
  readonly logger: ApplicationLogger;
}

export class VerificationService {
  readonly #dependencies: VerificationServiceDependencies;

  constructor(dependencies: VerificationServiceDependencies) {
    this.#dependencies = dependencies;
  }

  // 트랜잭션 내부에서만 사용. 이메일 발송은 트랜잭션 후 sendVerificationEmail()로 별도 처리
  async createEmailVerification(userId: string): Promise<VerificationCodeResult> {
    await this.#checkResendCooldown(userId, "EMAIL_VERIFY");

    await this.#dependencies.verificationRepository.invalidateAllByUserIdAndType(
      userId,
      "EMAIL_VERIFY",
    );

    const result = await this.#createVerificationCode(userId, "EMAIL_VERIFY");

    this.#dependencies.logger.log({
      event: IdentityLogEvent.VERIFICATION_CREATED,
      userId,
      verificationType: "EMAIL_VERIFY",
    });
    return result;
  }

  // 이메일 발송 실패는 로그만 남기고 예외를 던지지 않음 (재발송 가능)
  async sendVerificationEmail(email: string, code: string): Promise<void> {
    const emailResult = await this.#dependencies.emailSender.sendVerificationCode(email, {
      code,
      expiryMinutes: VERIFICATION_CODE.EXPIRY_MINUTES,
    });

    if (!emailResult.success) {
      this.#dependencies.logger.error({
        event: IdentityLogEvent.VERIFICATION_EMAIL_FAILED,
        verificationType: "EMAIL_VERIFY",
      });
    }
  }

  async createAndSendPasswordReset(userId: string, email: string): Promise<VerificationCodeResult> {
    await this.#checkResendCooldown(userId, "PASSWORD_RESET");

    await this.#dependencies.verificationRepository.invalidateAllByUserIdAndType(
      userId,
      "PASSWORD_RESET",
    );

    const result = await this.#createVerificationCode(userId, "PASSWORD_RESET");

    const emailResult = await this.#dependencies.emailSender.sendPasswordResetCode(email, {
      code: result.code,
      expiryMinutes: VERIFICATION_CODE.EXPIRY_MINUTES,
    });

    if (!emailResult.success) {
      this.#dependencies.logger.error({
        event: IdentityLogEvent.VERIFICATION_EMAIL_FAILED,
        verificationType: "PASSWORD_RESET",
        userId,
      });
    }

    this.#dependencies.logger.log({
      event: IdentityLogEvent.VERIFICATION_CREATED,
      userId,
      verificationType: "PASSWORD_RESET",
    });
    return result;
  }

  async createAndSendPasswordSetup(userId: string, email: string): Promise<VerificationCodeResult> {
    await this.#checkResendCooldown(userId, "PASSWORD_SETUP");

    await this.#dependencies.verificationRepository.invalidateAllByUserIdAndType(
      userId,
      "PASSWORD_SETUP",
    );

    const result = await this.#createVerificationCode(userId, "PASSWORD_SETUP");

    const emailResult = await this.#dependencies.emailSender.sendPasswordSetupCode(email, {
      code: result.code,
      expiryMinutes: VERIFICATION_CODE.EXPIRY_MINUTES,
    });

    if (!emailResult.success) {
      this.#dependencies.logger.error({
        event: IdentityLogEvent.VERIFICATION_EMAIL_FAILED,
        verificationType: "PASSWORD_SETUP",
        userId,
      });
    }

    this.#dependencies.logger.log({
      event: IdentityLogEvent.VERIFICATION_CREATED,
      userId,
      verificationType: "PASSWORD_SETUP",
    });
    return result;
  }

  async verifyCode(userId: string, code: string, type: VerificationType): Promise<boolean> {
    const at = now();
    const verification = await this.#dependencies.verificationRepository.findValidByUserIdAndType(
      userId,
      type,
      at,
    );

    if (verification === null) {
      throw new ApplicationException(ErrorCode.VERIFY_0751);
    }

    const challenge = AuthVerification.reconstitute(verification);
    match(challenge.validityAt(at))
      .with("valid", () => undefined)
      .with("exhausted", () => {
        throw new ApplicationException(ErrorCode.VERIFY_0754);
      })
      .with("used", "expired", () => {
        throw new ApplicationException(ErrorCode.VERIFY_0751);
      })
      .exhaustive();

    const tokenHash = this.#dependencies.verificationCodeSecurity.hash(code);

    if (verification.token !== tokenHash) {
      // 호출자 TX가 롤백되어도 실패 횟수가 남도록 base client로 독립 커밋한다.
      await this.#dependencies.verificationRepository.incrementAttempts(verification.id);

      this.#dependencies.logger.warn({
        event: IdentityLogEvent.VERIFICATION_FAILED,
        userId,
        verificationType: type,
      });

      throw new ApplicationException(ErrorCode.VERIFY_0751);
    }

    const consumed = await this.#dependencies.verificationRepository.consume({
      id: verification.id,
      userId,
      type,
      tokenHash,
      maxAttempts: VERIFICATION_CODE.MAX_ATTEMPTS,
      at,
    });
    if (!consumed) {
      throw new ApplicationException(ErrorCode.VERIFY_0751);
    }
    challenge.consume(at);

    this.#dependencies.logger.log({
      event: IdentityLogEvent.VERIFICATION_CONSUMED,
      userId,
      verificationType: type,
    });
    return true;
  }

  async #checkResendCooldown(userId: string, type: VerificationType): Promise<void> {
    const cooldownSince = subtractSeconds(VERIFICATION_CODE.RESEND_COOLDOWN_SECONDS);

    const recentCount = await this.#dependencies.verificationRepository.countRecentByUserIdAndType(
      userId,
      type,
      cooldownSince,
    );

    if (recentCount > 0) {
      throw new ApplicationException(ErrorCode.VERIFY_0753, {
        remainingSeconds: VERIFICATION_CODE.RESEND_COOLDOWN_SECONDS,
      });
    }
  }

  async #createVerificationCode(
    userId: string,
    type: VerificationType,
  ): Promise<VerificationCodeResult> {
    const generatedCode = this.#dependencies.verificationCodeSecurity.generate();
    const verificationCode = VerificationCode.create(generatedCode.plaintext, generatedCode.digest);

    const expiresAt = addMinutes(VERIFICATION_CODE.EXPIRY_MINUTES);

    await this.#dependencies.verificationRepository.create({
      userId,
      type,
      token: verificationCode.hash,
      expiresAt,
    });

    return { code: verificationCode.value, expiresAt };
  }
}
