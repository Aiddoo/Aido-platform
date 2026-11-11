import { MARKETING_CONSENT_RECONFIRM_YEARS } from "@aido/api/vocabulary";
import { minBy } from "es-toolkit";

import type { UserConsentRecord } from "./user-consent.constants.js";

type MarketingConsentState = Pick<UserConsentRecord, "marketingAgreedAt" | "marketingPushAgreedAt">;

export function resolveMarketingAgreement(
  agreed: boolean,
  at: Temporal.Instant,
): Temporal.Instant | null {
  return agreed ? at : null;
}

/** 이 시각 이전에 동의했거나 마지막으로 다시 알린 사용자에게 수신 동의 사실을 다시 알린다. */
export function marketingReconfirmCutoff(now: Temporal.Instant): Temporal.Instant {
  // UTC 달력으로 빼고 말일은 그 달 마지막 날로 맞춘다
  return now
    .toZonedDateTimeISO("UTC")
    .subtract({ months: MARKETING_CONSENT_RECONFIRM_YEARS * 12 })
    .toInstant();
}

/** 광고성 수신에 처음 동의한 시각(이메일·앱 푸시 중 이른 쪽). 동의가 없으면 null이다. */
export function marketingAgreedSince(consent: MarketingConsentState): Temporal.Instant | null {
  return (
    minBy(
      [consent.marketingAgreedAt, consent.marketingPushAgreedAt].flatMap((instant) =>
        instant == null ? [] : [instant],
      ),
      (instant) => instant.epochMilliseconds,
    ) ?? null
  );
}
