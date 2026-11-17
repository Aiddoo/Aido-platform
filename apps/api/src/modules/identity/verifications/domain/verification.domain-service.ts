import { VERIFICATION_CODE } from "@aido/api/vocabulary";

import { isExpiredAt } from "../../shared/domain/expiry.domain-service.js";
import type { Verification } from "./verification.aggregate.js";
import { type VERIFICATION_REJECTIONS, VERIFICATION_EMAIL_CAP } from "./verifications.constants.js";

type VerificationRejection = (typeof VERIFICATION_REJECTIONS)[number];

export type VerificationAttemptJudgement =
  | { readonly ok: true; readonly verification: Verification }
  | { readonly ok: false; readonly reason: VerificationRejection };

export type VerificationEmailCapJudgement =
  | { readonly ok: true; readonly sentAts: readonly Temporal.Instant[] }
  | { readonly ok: false; readonly availableAt: Temporal.Instant };

/** 이 시각 뒤에 같은 종류 코드를 발급했으면 아직 다시 보낼 수 없다 */
export function resendCooldownStartsAt(now: Temporal.Instant): Temporal.Instant {
  return now.subtract({ seconds: VERIFICATION_CODE.RESEND_COOLDOWN_SECONDS });
}

/** 다시 보낼 수 있을 때까지 남은 초. 막는 동안은 1초 밑도 1초로 올려 앱 타이머가 0에서 멈추지 않는다 */
export function resendRemainingSeconds(
  availableAt: Temporal.Instant,
  now: Temporal.Instant,
): number {
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

/**
 * 이메일로 보낸 코드가 24시간 창 안에 상한만큼 있으면 그중 하나가 창을 벗어날 때까지 막는다.
 * 보낼 수 있으면 창 안 기록에 이번 시각을 더해 준다. 보낸 지 24시간 정각부터 창 밖이다(isExpiredAt과 같은 경계)
 */
export function judgeVerificationEmailCap(
  sentAts: readonly Temporal.Instant[],
  now: Temporal.Instant,
): VerificationEmailCapJudgement {
  const capWindow = { hours: VERIFICATION_EMAIL_CAP.WINDOW_HOURS };
  const inWindow = sentAts
    .filter((sentAt) => !isExpiredAt(sentAt.add(capWindow), now))
    .toSorted(Temporal.Instant.compare);
  const oldestBlocking = inWindow.at(-VERIFICATION_EMAIL_CAP.MAX_CODES);
  if (oldestBlocking != null) {
    return { ok: false, availableAt: oldestBlocking.add(capWindow) };
  }
  return { ok: true, sentAts: [...inWindow, now] };
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
