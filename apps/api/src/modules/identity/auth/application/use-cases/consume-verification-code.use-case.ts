import { ErrorCode } from "@aido/api/errors";
import { VERIFICATION_CODE } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { judgeVerificationAttempt } from "../../domain/auth-verification.domain-service.js";
import type { VerificationType } from "../../domain/auth.constants.js";
import { AuthLogEvent } from "../auth.log-events.js";
import type { AuthVerificationRepositoryPort } from "../ports/auth-verification.repository.port.js";
import type { VerificationCodeSecurityPort } from "../ports/verification-code-security.port.js";

export interface ConsumeVerificationCodeCommand {
  readonly userId: string;
  readonly code: string;
  readonly type: VerificationType;
}

interface ConsumeVerificationCodeDependencies {
  readonly verificationRepository: Pick<
    AuthVerificationRepositoryPort,
    "findValidByUserIdAndType" | "incrementAttempts" | "consume"
  >;
  readonly verificationCodeSecurity: Pick<VerificationCodeSecurityPort, "hash">;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

/** 맞는 코드면 한 번만 사용 처리한다. 호출자가 연 트랜잭션에 함께 커밋된다 */
export class ConsumeVerificationCodeUseCase {
  readonly #dependencies: ConsumeVerificationCodeDependencies;

  constructor(dependencies: ConsumeVerificationCodeDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: ConsumeVerificationCodeCommand): Promise<void> {
    const { verificationRepository, verificationCodeSecurity, clock, logger } = this.#dependencies;
    const { type } = command;
    const userId = UserId.reconstitute(command.userId);
    const now = clock.now();
    const verification = await verificationRepository.findValidByUserIdAndType(userId, type, now);
    const tokenHash = verificationCodeSecurity.hash(command.code);
    const judgement = judgeVerificationAttempt({ verification, tokenHash, now });

    if (!judgement.ok) {
      if (judgement.reason === "mismatch" && verification != null) {
        await verificationRepository.incrementAttempts(verification.id);
        logger.warn({
          event: AuthLogEvent.VERIFICATION_FAILED,
          userId: command.userId,
          verificationType: type,
        });
      }
      throw match(judgement.reason)
        .with("exhausted", () => new ApplicationException(ErrorCode.VERIFY_0754))
        .with(
          "missing",
          "used",
          "expired",
          "mismatch",
          () => new ApplicationException(ErrorCode.VERIFY_0751),
        )
        .exhaustive();
    }

    const consumed = await verificationRepository.consume({
      id: judgement.verification.id,
      userId,
      type,
      tokenHash,
      maxAttempts: VERIFICATION_CODE.MAX_ATTEMPTS,
      at: now,
    });
    if (!consumed) {
      throw new ApplicationException(ErrorCode.VERIFY_0751);
    }

    logger.log({
      event: AuthLogEvent.VERIFICATION_CONSUMED,
      userId: command.userId,
      verificationType: type,
    });
  }
}
