import { VERIFICATION_CODE } from "@aido/api/vocabulary";

import { isExpiredAt } from "../../shared/domain/expiry.domain-service.js";
import type { Verification } from "./verification.aggregate.js";
import { type VERIFICATION_REJECTIONS, VERIFICATION_EMAIL_CAP } from "./verifications.constants.js";

type VerificationRejection = (typeof VERIFICATION_REJECTIONS)[number];

const EMAIL_CAP_WINDOW = { hours: VERIFICATION_EMAIL_CAP.WINDOW_HOURS };

export type VerificationAttemptJudgement =
  | { readonly ok: true; readonly verification: Verification }
  | { readonly ok: false; readonly reason: VerificationRejection };

export type VerificationEmailCapJudgement =
  | { readonly ok: true }
  | { readonly ok: false; readonly remainingSeconds: number };

/** 이 시각 뒤에 같은 종류 코드를 발급했으면 아직 다시 보낼 수 없다 */
export function resendCooldownStartsAt(now: Temporal.Instant): Temporal.Instant {
  return now.subtract({ seconds: VERIFICATION_CODE.RESEND_COOLDOWN_SECONDS });
}

/** 다시 보낼 수 있을 때까지 남은 초. 막는 동안은 1초 밑도 1초로 올려 앱 타이머가 0에서 멈추지 않는다 */
function resendRemainingSeconds(availableAt: Temporal.Instant, now: Temporal.Instant): number {
  return Math.max(1, Math.ceil(availableAt.since(now).total("seconds")));
}

/** 마지막 발급에서 다시 보낼 수 있을 때까지 남은 초 */
export function resendCooldownRemainingSeconds(
  lastIssuedAt: Temporal.Instant,
  now: Temporal.Instant,
): number {
  return resendRemainingSeconds(
    lastIssuedAt.add({ seconds: VERIFICATION_CODE.RESEND_COOLDOWN_SECONDS }),
    now,
  );
}

/** 24시간 창 안에 보낸 시각들. 보낸 지 24시간 정각부터 창 밖이다(isExpiredAt과 같은 경계) */
export function sentAtsInEmailCapWindow(
  sentAts: readonly Temporal.Instant[],
  now: Temporal.Instant,
): Temporal.Instant[] {
  return sentAts
    .filter((sentAt) => !isExpiredAt(sentAt.add(EMAIL_CAP_WINDOW), now))
    .toSorted(Temporal.Instant.compare);
}

/**
 * 창 안에 보낸 코드가 상한만큼 있으면 막는다. 남은 초는 다시 보내기 대기(60초)를 넘기지 않는다.
 * 출시 앱은 이 값을 초 단위 타이머로, 문구는 "1분 뒤"로만 보여 줘 하루치 초를 그대로 주면 어색하다
 */
export function judgeVerificationEmailCap(
  sentAts: readonly Temporal.Instant[],
  now: Temporal.Instant,
): VerificationEmailCapJudgement {
  const oldestBlocking = sentAtsInEmailCapWindow(sentAts, now).at(
    -VERIFICATION_EMAIL_CAP.MAX_CODES,
  );
  if (oldestBlocking == null) {
    return { ok: true };
  }
  return {
    ok: false,
    remainingSeconds: Math.min(
      resendRemainingSeconds(oldestBlocking.add(EMAIL_CAP_WINDOW), now),
      VERIFICATION_CODE.RESEND_COOLDOWN_SECONDS,
    ),
  };
}

// 코드가 맞는지는 쓸 수 있는 코드일 때만 본다. 소진·만료 코드에 맞는 값을 넣어도 시도로 세지 않는다
export function judgeVerificationAttempt(params: {
  readonly verification: Verification | null;
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
