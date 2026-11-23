import type { VerificationEmailCapPort } from "../ports/verification-email-cap.port.js";
import type { VerificationEmailCapReservation } from "./reserve-verification-email-cap.use-case.js";

interface ReleaseVerificationEmailCapDependencies {
  readonly verificationEmailCap: VerificationEmailCapPort;
}

/** 보냈다고 답하지 않은 요청(대기·이미 인증·계정 상태로 거절)이 미리 센 한 통을 상한에서 뺀다 */
export class ReleaseVerificationEmailCapUseCase {
  readonly #dependencies: ReleaseVerificationEmailCapDependencies;

  constructor(dependencies: ReleaseVerificationEmailCapDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(reservation: VerificationEmailCapReservation): Promise<void> {
    const { verificationEmailCap } = this.#dependencies;
    await Promise.all(
      reservation.buckets.map(async (bucket) => {
        const sentAts = await verificationEmailCap.listSentAts(bucket);
        const reservedIndex = sentAts.findIndex((sentAt) => sentAt.equals(reservation.sentAt));
        if (reservedIndex === -1) {
          return;
        }
        await verificationEmailCap.saveSentAts(bucket, sentAts.toSpliced(reservedIndex, 1));
      }),
    );
  }
}
