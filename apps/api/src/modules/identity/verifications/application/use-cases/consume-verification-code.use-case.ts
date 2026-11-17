import { VERIFICATION_CODE } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { judgeVerificationAttempt } from "../../domain/verification.domain-service.js";
import type { VerificationType } from "../../domain/verifications.constants.js";
import type { VerificationCodeSecurityPort } from "../ports/verification-code-security.port.js";
import type { VerificationRepositoryPort } from "../ports/verification.repository.port.js";
import { invalidVerificationCode, verificationAttemptsExceeded } from "../verifications.errors.js";
import { VerificationLogEvent } from "../verifications.log-events.js";

export interface ConsumeVerificationCodeCommand {
  readonly userId: string;
  readonly code: string;
  readonly type: VerificationType;
}

interface ConsumeVerificationCodeDependencies {
  readonly verificationRepository: Pick<
    VerificationRepositoryPort,
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
      if (judgement.reason === "mismatch" && verification?.recordFailedAttempt(now) === true) {
        await verificationRepository.incrementAttempts(verification.id);
        logger.warn({
          event: VerificationLogEvent.VERIFICATION_FAILED,
          userId: command.userId,
          verificationType: type,
        });
      }
      throw match(judgement.reason)
        .with("exhausted", () => verificationAttemptsExceeded())
        .with("missing", "used", "expired", "mismatch", () => invalidVerificationCode())
        .exhaustive();
    }

    if (!judgement.verification.consume(now)) {
      throw invalidVerificationCode();
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
      throw invalidVerificationCode();
    }

    logger.log({
      event: VerificationLogEvent.VERIFICATION_CONSUMED,
      userId: command.userId,
      verificationType: type,
    });
  }
}
