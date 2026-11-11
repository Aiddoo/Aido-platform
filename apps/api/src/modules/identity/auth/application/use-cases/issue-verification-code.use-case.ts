import { ErrorCode } from "@aido/api/errors";
import { VERIFICATION_CODE } from "@aido/api/vocabulary";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { AuthVerification } from "../../domain/auth-verification.aggregate.js";
import { resendCooldownStartsAt } from "../../domain/auth-verification.domain-service.js";
import type { VerificationType } from "../../domain/auth.constants.js";
import { AuthLogEvent } from "../auth.log-events.js";
import type { AuthVerificationRepositoryPort } from "../ports/auth-verification.repository.port.js";
import type { VerificationCodeSecurityPort } from "../ports/verification-code-security.port.js";

export interface IssueVerificationCodeCommand {
  readonly userId: string;
  readonly type: VerificationType;
}

export interface IssuedVerificationCode {
  readonly code: string;
  readonly expiresAt: Temporal.Instant;
}

interface IssueVerificationCodeDependencies {
  readonly verificationRepository: Pick<
    AuthVerificationRepositoryPort,
    "countRecentByUserIdAndType" | "invalidateAllByUserIdAndType" | "nextId" | "save"
  >;
  readonly verificationCodeSecurity: Pick<VerificationCodeSecurityPort, "generate">;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

/** 같은 종류의 남은 코드를 만료시키고 새 코드를 발급한다. 메일 발송은 호출자가 커밋 뒤에 한다 */
export class IssueVerificationCodeUseCase {
  readonly #dependencies: IssueVerificationCodeDependencies;

  constructor(dependencies: IssueVerificationCodeDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: IssueVerificationCodeCommand): Promise<IssuedVerificationCode> {
    const { verificationRepository, verificationCodeSecurity, clock, logger } = this.#dependencies;
    const { type } = command;
    const userId = UserId.reconstitute(command.userId);
    const now = clock.now();

    const recentCount = await verificationRepository.countRecentByUserIdAndType(
      userId,
      type,
      resendCooldownStartsAt(now),
    );
    if (recentCount > 0) {
      throw new ApplicationException(ErrorCode.VERIFY_0753, {
        remainingSeconds: VERIFICATION_CODE.RESEND_COOLDOWN_SECONDS,
      });
    }

    await verificationRepository.invalidateAllByUserIdAndType(userId, type, now);

    const generated = verificationCodeSecurity.generate();
    const verification = AuthVerification.create({
      id: await verificationRepository.nextId(),
      userId: command.userId,
      type,
      tokenHash: generated.digest,
      now,
    });
    await verificationRepository.save(verification);

    logger.log({
      event: AuthLogEvent.VERIFICATION_CREATED,
      userId: command.userId,
      verificationType: type,
    });
    return { code: generated.plaintext, expiresAt: verification.expiresAt };
  }
}
