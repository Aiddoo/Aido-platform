import type { ClockPort } from "#api/shared/application/ports/clock.port";

import { judgeVerificationEmailCap } from "../../domain/verification.domain-service.js";
import type { VerificationEmailCapPort } from "../ports/verification-email-cap.port.js";
import { verificationResendCooldown } from "../verifications.errors.js";

export interface CheckVerificationEmailCapCommand {
  readonly email: string;
}

interface CheckVerificationEmailCapDependencies {
  readonly verificationEmailCap: Pick<VerificationEmailCapPort, "findSentAts">;
  readonly clock: ClockPort;
}

/** 이 이메일로 24시간 안에 보낸 코드가 상한이면 VERIFY_0753이다. 세는 것은 보낸 뒤의 Record다 */
export class CheckVerificationEmailCapUseCase {
  readonly #dependencies: CheckVerificationEmailCapDependencies;

  constructor(dependencies: CheckVerificationEmailCapDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: CheckVerificationEmailCapCommand): Promise<void> {
    const { verificationEmailCap, clock } = this.#dependencies;
    const judgement = judgeVerificationEmailCap(
      await verificationEmailCap.findSentAts(command.email),
      clock.now(),
    );
    if (!judgement.ok) {
      throw verificationResendCooldown(judgement.remainingSeconds);
    }
  }
}
