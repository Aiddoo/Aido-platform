import { ErrorCode } from "@aido/api/errors";
import { SECURITY_EVENT, type SupportedLocale } from "@aido/api/vocabulary";

import type { RequestMetadata } from "#api/modules/identity/shared/domain/request-metadata.constants";
import { REQUEST_ORIGIN_DEFAULTS } from "#api/modules/identity/shared/domain/request-metadata.constants";
import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";

import type { SecurityLogRepositoryPort } from "../../../users/application/ports/security-log.repository.port.js";
import type { UserRepositoryPort } from "../../../users/application/ports/user.repository.port.js";
import type { CheckVerificationEmailCapUseCase } from "../../../verifications/application/use-cases/check-verification-email-cap.use-case.js";
import type {
  IssueVerificationCodeUseCase,
  IssuedVerificationCode,
} from "../../../verifications/application/use-cases/issue-verification-code.use-case.js";
import type { RecordVerificationEmailSentUseCase } from "../../../verifications/application/use-cases/record-verification-email-sent.use-case.js";
import type { SendVerificationCodeUseCase } from "../../../verifications/application/use-cases/send-verification-code.use-case.js";
import { verificationResendCooldown } from "../../../verifications/application/verifications.errors.js";
import { resendCooldownRemainingSeconds } from "../../../verifications/domain/verification.domain-service.js";
import { LinkedAccountsLogEvent } from "../linked-accounts.log-events.js";
import type { PasswordResetCooldownPort } from "../ports/password-reset-cooldown.port.js";

const RESET_REQUEST_MESSAGE = "등록된 이메일인 경우 비밀번호 재설정 코드가 발송됩니다.";

export interface RequestPasswordResetCommand {
  readonly email: string;
  readonly metadata?: RequestMetadata;
  /** 코드 메일을 쓸 언어. 요청 응답과 같은 언어다 */
  readonly emailLocale: SupportedLocale;
}

interface RequestPasswordResetDependencies {
  readonly userRepository: Pick<UserRepositoryPort, "findByEmail">;
  readonly checkVerificationEmailCap: Pick<CheckVerificationEmailCapUseCase, "execute">;
  readonly recordVerificationEmailSent: Pick<RecordVerificationEmailSentUseCase, "execute">;
  readonly issueVerificationCode: Pick<IssueVerificationCodeUseCase, "execute">;
  readonly sendVerificationCode: Pick<SendVerificationCodeUseCase, "execute">;
  readonly securityLogRepository: Pick<SecurityLogRepositoryPort, "create">;
  readonly resetCooldown: PasswordResetCooldownPort;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

export class RequestPasswordResetUseCase {
  readonly #dependencies: RequestPasswordResetDependencies;

  constructor(dependencies: RequestPasswordResetDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RequestPasswordResetCommand): Promise<{ message: string }> {
    const { email, metadata, emailLocale } = input;
    const ip = metadata?.ip ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_IP;
    const userAgent = metadata?.userAgent ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_USER_AGENT;

    // 대기·상한은 계정을 찾기 전에 이메일마다 잡는다. 없는 이메일도 같은 VERIFY_0753·남은 초를 받는다
    const now = this.#dependencies.clock.now();
    const cooldownStartedAt = await this.#dependencies.resetCooldown.findStartedAt(email, now);
    if (cooldownStartedAt != null) {
      throw verificationResendCooldown(resendCooldownRemainingSeconds(cooldownStartedAt, now));
    }
    await this.#dependencies.checkVerificationEmailCap.execute({ email });
    await this.#dependencies.resetCooldown.start(email, now);
    // 대기를 지난 요청은 가입 여부와 상관없이 보냈다고 답하므로 모두 같은 수로 센다
    await this.#dependencies.recordVerificationEmailSent.execute({ email });

    const user = await this.#dependencies.userRepository.findByEmail(email);

    if (user != null && user.deletedAt == null) {
      const issued = await this.#issueUnlessCoolingDown(user.id.value);
      if (issued == null) {
        this.#dependencies.logger.debug({
          event: LinkedAccountsLogEvent.PASSWORD_RESET_REQUEST_SKIPPED,
        });
        return { message: RESET_REQUEST_MESSAGE };
      }
      await this.#dependencies.sendVerificationCode.execute({
        userId: user.id.value,
        email,
        code: issued.code,
        type: "PASSWORD_RESET",
        emailLocale,
      });

      await this.#dependencies.securityLogRepository.create({
        userId: user.id,
        event: SECURITY_EVENT.PASSWORD_RESET_REQUESTED,
        ipAddress: ip,
        userAgent,
        metadata: { email },
      });

      this.#dependencies.logger.debug({
        event: LinkedAccountsLogEvent.PASSWORD_RESET_REQUESTED,
        userId: user.id.value,
      });
    } else {
      this.#dependencies.logger.debug({
        event: LinkedAccountsLogEvent.PASSWORD_RESET_REQUEST_SKIPPED,
      });
    }

    return { message: RESET_REQUEST_MESSAGE };
  }

  // 계정 대기(코드 발급 60초)는 없는 이메일에는 없어 VERIFY_0753을 그대로 주면 가입 여부가 드러난다.
  // 이메일 대기가 캐시에서 사라졌거나 경계에 걸려도 같은 성공 응답을 주고 메일만 보내지 않는다
  async #issueUnlessCoolingDown(userId: string): Promise<IssuedVerificationCode | null> {
    try {
      return await this.#dependencies.issueVerificationCode.execute({
        userId,
        type: "PASSWORD_RESET",
      });
    } catch (error) {
      if (error instanceof ApplicationException && error.errorCode === ErrorCode.VERIFY_0753) {
        return null;
      }
      throw error;
    }
  }
}
