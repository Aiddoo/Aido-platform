import type { SupportedLocale } from "#api/shared/domain/locale";

import { NOTIFICATION_COPY_CATALOG } from "./notification-copy-catalog.messages.js";

/**
 * 광고성 푸시의 제목·본문에 표기를 붙인다(정보통신망법 제50조: 제목 앞 "(광고)"와 본문 끝 수신 거부 방법).
 * 이미 붙은 제목은 다시 붙이지 않는다. 푸시 전용이라 알림함 렌더링에는 붙이지 않는다.
 */
export function withMarketingPushLabel(
  content: { readonly title: string; readonly body: string },
  locale: SupportedLocale,
): { readonly title: string; readonly body: string } {
  const label = NOTIFICATION_COPY_CATALOG[locale].parts.marketing;
  return {
    title: content.title.startsWith(label.titlePrefix)
      ? content.title
      : `${label.titlePrefix}${content.title}`,
    body: `${content.body}\n${label.optOut}`,
  };
}
