import type { ClockPort } from "#api/shared/application/ports/clock.port";

import {
  judgeVerificationEmailCap,
  resendRemainingSeconds,
} from "../../domain/verification.domain-service.js";
import type { VerificationEmailCapPort } from "../ports/verification-email-cap.port.js";
import { verificationResendCooldown } from "../verifications.errors.js";

export interface ReserveVerificationEmailSlotCommand {
  readonly email: string;
}

interface ReserveVerificationEmailSlotDependencies {
  readonly verificationEmailCap: VerificationEmailCapPort;
  readonly clock: ClockPort;
}

/** 인증 코드를 보낼 요청을 이메일마다 센다. 24시간 안에 10번을 넘으면 세지 않고 VERIFY_0753이다 */
export class ReserveVerificationEmailSlotUseCase {
  readonly #dependencies: ReserveVerificationEmailSlotDependencies;

  constructor(dependencies: ReserveVerificationEmailSlotDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: ReserveVerificationEmailSlotCommand): Promise<void> {
    const { verificationEmailCap, clock } = this.#dependencies;
    const now = clock.now();
    const judgement = judgeVerificationEmailCap(
      await verificationEmailCap.findSentAts(command.email),
      now,
    );
    if (!judgement.ok) {
      throw verificationResendCooldown(resendRemainingSeconds(judgement.availableAt, now));
    }
    // 읽고 쓰기가 원자적이지 않아 같은 이메일의 동시 요청 몇 개는 상한을 넘길 수 있다. IP 요청 한도가 그 수를 묶는다
    await verificationEmailCap.saveSentAts(command.email, judgement.sentAts);
  }
}
