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

/** 한 기준(이메일·IP·사용자)으로 센 창 안팎의 보낸 시각과 그 기준의 상한 */
export interface VerificationEmailCapCount {
  readonly sentAts: readonly Temporal.Instant[];
  readonly maxCodes: number;
  /** 상한을 채운 뒤에도 마지막으로 보낸 지 이만큼 지나면 한 통을 더 보낸다. 없으면 창이 풀릴 때까지 막는다 */
  readonly afterCapIntervalMinutes?: number;
}

function capRemainingSeconds(
  count: VerificationEmailCapCount,
  now: Temporal.Instant,
): number | null {
  const inWindow = sentAtsInEmailCapWindow(count.sentAts, now);
  const oldestBlocking = inWindow.at(-count.maxCodes);
  const lastSentAt = inWindow.at(-1);
  if (oldestBlocking == null || lastSentAt == null) {
    return null;
  }
  const windowReleasesAt = oldestBlocking.add(EMAIL_CAP_WINDOW);
  if (count.afterCapIntervalMinutes == null) {
    return resendRemainingSeconds(windowReleasesAt, now);
  }
  const intervalReleasesAt = lastSentAt.add({ minutes: count.afterCapIntervalMinutes });
  if (isExpiredAt(intervalReleasesAt, now)) {
    return null;
  }
  const releasesAt =
    Temporal.Instant.compare(intervalReleasesAt, windowReleasesAt) < 0
      ? intervalReleasesAt
      : windowReleasesAt;
  return resendRemainingSeconds(releasesAt, now);
}

/**
 * 기준 하나라도 창 안에 보낸 코드가 상한만큼 있으면 막는다(상한 뒤 간격이 있는 기준은 그 간격이 지나면 한 통 보낸다).
 * 남은 초는 다시 보내기 대기(60초)를 넘기지 않는다.
 * 출시 앱은 이 값을 초 단위 타이머로, 문구는 "1분 뒤"로만 보여 줘 하루치 초를 그대로 주면 어색하다
 */
export function judgeVerificationEmailCap(
  counts: readonly VerificationEmailCapCount[],
  now: Temporal.Instant,
): VerificationEmailCapJudgement {
  const blockedSeconds = counts.flatMap((count) => capRemainingSeconds(count, now) ?? []);
  if (blockedSeconds.length === 0) {
    return { ok: true };
  }
  return {
    ok: false,
    remainingSeconds: Math.min(
      Math.max(...blockedSeconds),
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
