import { MARKETING_CONSENT_RECONFIRM_YEARS } from "@aido/api/vocabulary";
import { minBy } from "es-toolkit";

import { subtractMonths } from "#api/shared/domain/date/utils/arithmetic";

import type { UserConsentRecord } from "../../records/settings/user-consent.record.js";

type MarketingConsentState = Pick<UserConsentRecord, "marketingAgreedAt" | "marketingPushAgreedAt">;

export function resolveMarketingAgreement(agreed: boolean, at: Date): Date | null {
  return agreed ? new Date(at) : null;
}

/** 이 시각 이전에 동의했거나 마지막으로 다시 알린 사용자에게 수신 동의 사실을 다시 알린다. */
export function marketingReconfirmCutoff(now: Date): Date {
  return subtractMonths(MARKETING_CONSENT_RECONFIRM_YEARS * 12, now);
}

/** 광고성 수신에 처음 동의한 시각(이메일·앱 푸시 중 이른 쪽). 동의가 없으면 null이다. */
export function marketingAgreedSince(consent: MarketingConsentState): Date | null {
  const agreedAt = minBy(
    [consent.marketingAgreedAt, consent.marketingPushAgreedAt].flatMap((date) =>
      date == null ? [] : [date],
    ),
    (date) => date.getTime(),
  );
  return agreedAt == null ? null : new Date(agreedAt);
}
