import { VERIFICATION_CODE } from "@aido/api/vocabulary";

import type { AuthVerification } from "./auth-verification.aggregate.js";
import type { VERIFICATION_REJECTIONS } from "./auth.constants.js";

type VerificationRejection = (typeof VERIFICATION_REJECTIONS)[number];

export type VerificationAttemptJudgement =
  | { readonly ok: true; readonly verification: AuthVerification }
  | { readonly ok: false; readonly reason: VerificationRejection };

/** 이 시각 뒤에 같은 종류 코드를 발급했으면 아직 다시 보낼 수 없다 */
export function resendCooldownStartsAt(now: Temporal.Instant): Temporal.Instant {
  return now.subtract({ seconds: VERIFICATION_CODE.RESEND_COOLDOWN_SECONDS });
}

/** 마지막 발급에서 다시 보낼 수 있을 때까지 남은 초. 막는 동안은 1초 밑도 1초로 올려 앱 타이머가 0에서 멈추지 않는다 */
export function resendCooldownRemainingSeconds(
  lastIssuedAt: Temporal.Instant,
  now: Temporal.Instant,
): number {
  const endsAt = lastIssuedAt.add({ seconds: VERIFICATION_CODE.RESEND_COOLDOWN_SECONDS });
  return Math.max(1, Math.ceil(endsAt.since(now).total("seconds")));
}

// 코드가 맞는지는 쓸 수 있는 코드일 때만 본다. 소진·만료 코드에 맞는 값을 넣어도 시도로 세지 않는다
export function judgeVerificationAttempt(params: {
  readonly verification: AuthVerification | null;
  readonly tokenHash: string;
  readonly now: Temporal.Instant;
}): VerificationAttemptJudgement {
  if (params.verification == null) {
    return { ok: false, reason: "missing" };
  }
  const validity = params.verification.validityAt(params.now);
  if (validity !== "valid") {
    return { ok: false, reason: validity };
  }
  if (!params.verification.matches(params.tokenHash)) {
    return { ok: false, reason: "mismatch" };
  }
  return { ok: true, verification: params.verification };
}
