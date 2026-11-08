import type { SupportedLocale } from "#api/shared/domain/locale";

interface MarketingPushLabel {
  readonly titlePrefix: string;
  readonly optOut: string;
}

/** 광고성 앱 푸시 표기(정보통신망법 제50조): 제목 앞 "(광고)"와 본문 끝 수신 거부 방법 */
const MARKETING_PUSH_LABEL = {
  ko: { titlePrefix: "(광고) ", optOut: "수신 거부: 설정 > 알림" },
  en: { titlePrefix: "(Ad) ", optOut: "Opt out: Settings > Notifications" },
} as const satisfies Record<SupportedLocale, MarketingPushLabel>;

/** 광고성 푸시의 제목·본문에 표기를 붙인다. 이미 붙은 제목은 다시 붙이지 않는다. */
export function withMarketingPushLabel(
  content: { readonly title: string; readonly body: string },
  locale: SupportedLocale,
): { readonly title: string; readonly body: string } {
  const label = MARKETING_PUSH_LABEL[locale];
  return {
    title: content.title.startsWith(label.titlePrefix)
      ? content.title
      : `${label.titlePrefix}${content.title}`,
    body: `${content.body}\n${label.optOut}`,
  };
}
