import { match, P } from "ts-pattern";

import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  judgeVerificationEmailCap,
  sentAtsInEmailCapWindow,
} from "../../domain/verification.domain-service.js";
import { VERIFICATION_EMAIL_CAP } from "../../domain/verifications.constants.js";
import type {
  VerificationEmailCapBucket,
  VerificationEmailCapPort,
} from "../ports/verification-email-cap.port.js";
import { verificationResendCooldown } from "../verifications.errors.js";

/** 로그인 전 흐름은 이메일과 요청 IP로, 로그인한 비밀번호 설정은 사용자로 센다 */
export type ReserveVerificationEmailCapCommand =
  | {
      readonly purpose: "EMAIL_VERIFY" | "PASSWORD_RESET";
      readonly email: string;
      readonly sourceIp: string;
    }
  | { readonly purpose: "PASSWORD_SETUP"; readonly userId: string };

/** 상한에 미리 센 한 통. 보냈다고 답하지 않으면 ReleaseVerificationEmailCapUseCase로 돌려준다 */
export interface VerificationEmailCapReservation {
  readonly buckets: readonly VerificationEmailCapBucket[];
  readonly sentAt: Temporal.Instant;
}

interface ReserveVerificationEmailCapDependencies {
  readonly verificationEmailCap: VerificationEmailCapPort;
  readonly clock: ClockPort;
}

function cappedBucketsFor(command: ReserveVerificationEmailCapCommand): readonly {
  readonly bucket: VerificationEmailCapBucket;
  readonly maxCodes: number;
  readonly afterCapIntervalMinutes?: number;
}[] {
  return match(command)
    .with({ purpose: "PASSWORD_SETUP" }, ({ purpose, userId }) => [
      {
        bucket: { scope: "user" as const, purpose, userId: UserId.reconstitute(userId) },
        maxCodes: VERIFICATION_EMAIL_CAP.MAX_CODES_PER_USER,
      },
    ])
    .with(
      { purpose: P.union("EMAIL_VERIFY", "PASSWORD_RESET") },
      ({ purpose, email, sourceIp }) => [
        {
          bucket: { scope: "email" as const, purpose, email },
          maxCodes: VERIFICATION_EMAIL_CAP.MAX_CODES_PER_EMAIL,
          afterCapIntervalMinutes: VERIFICATION_EMAIL_CAP.AFTER_EMAIL_CAP_INTERVAL_MINUTES,
        },
        {
          bucket: { scope: "email-source" as const, purpose, email, sourceIp },
          maxCodes: VERIFICATION_EMAIL_CAP.MAX_CODES_PER_EMAIL_SOURCE,
        },
      ],
    )
    .exhaustive();
}

/** 상한이 차 있으면 VERIFY_0753이고, 아니면 DB를 읽기 전에 이 요청을 미리 센다 */
export class ReserveVerificationEmailCapUseCase {
  readonly #dependencies: ReserveVerificationEmailCapDependencies;

  constructor(dependencies: ReserveVerificationEmailCapDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    command: ReserveVerificationEmailCapCommand,
  ): Promise<VerificationEmailCapReservation> {
    const { verificationEmailCap, clock } = this.#dependencies;
    const now = clock.now();
    const counts = await Promise.all(
      cappedBucketsFor(command).map(async ({ bucket, ...cap }) => ({
        bucket,
        ...cap,
        sentAts: sentAtsInEmailCapWindow(await verificationEmailCap.findSentAts(bucket), now),
      })),
    );
    const judgement = judgeVerificationEmailCap(counts, now);
    if (!judgement.ok) {
      throw verificationResendCooldown(judgement.remainingSeconds);
    }
    // 캐시 읽기와 쓰기 사이에 같은 기준의 동시 요청이 끼면 몇 통 넘길 수 있다. IP 요청 한도가 그 수를 묶는다
    await Promise.all(
      counts.map(({ bucket, sentAts }) =>
        verificationEmailCap.saveSentAts(bucket, [...sentAts, now]),
      ),
    );
    return { buckets: counts.map(({ bucket }) => bucket), sentAt: now };
  }
}
