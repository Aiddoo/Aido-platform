import type { ClockPort } from "#api/shared/application/ports/clock.port";

import { sentAtsInEmailCapWindow } from "../../domain/verification.domain-service.js";
import type { VerificationEmailCapPort } from "../ports/verification-email-cap.port.js";

export interface RecordVerificationEmailSentCommand {
  readonly email: string;
}

interface RecordVerificationEmailSentDependencies {
  readonly verificationEmailCap: VerificationEmailCapPort;
  readonly clock: ClockPort;
}

/** 코드를 보냈다고 답한 요청만 이메일 상한에 센다. 대기·이미 인증으로 거절한 요청은 세지 않는다 */
export class RecordVerificationEmailSentUseCase {
  readonly #dependencies: RecordVerificationEmailSentDependencies;

  constructor(dependencies: RecordVerificationEmailSentDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: RecordVerificationEmailSentCommand): Promise<void> {
    const { verificationEmailCap, clock } = this.#dependencies;
    const now = clock.now();
    const sentAts = sentAtsInEmailCapWindow(
      await verificationEmailCap.findSentAts(command.email),
      now,
    );
    // 읽고 쓰기가 원자적이지 않아 같은 이메일의 동시 요청 몇 개는 상한을 넘길 수 있다. IP 요청 한도가 그 수를 묶는다
    await verificationEmailCap.saveSentAts(command.email, [...sentAts, now]);
  }
}
