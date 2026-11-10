import type { SupportedLocale } from "#api/shared/domain/locale";

import type { NotificationCopy } from "./notification-copy-catalog.messages.js";
import { NOTIFICATION_COPY_TEMPLATES } from "./notification-copy-templates.messages.js";
import type { StoredNotificationCopyTemplate } from "./notification-copy.messages.js";

const TEMPLATES_BY_KEY: ReadonlyMap<string, StoredNotificationCopyTemplate> = new Map(
  Object.values(NOTIFICATION_COPY_TEMPLATES).flatMap((group) =>
    Object.values<StoredNotificationCopyTemplate>(group).map((template) => [
      template.key,
      template,
    ]),
  ),
);

/** 모든 푸시 템플릿. 카탈로그 짝·렌더 검사가 쓴다. */
export const STORED_NOTIFICATION_COPY_TEMPLATES: readonly StoredNotificationCopyTemplate[] = [
  ...TEMPLATES_BY_KEY.values(),
];

/**
 * 저장한 알림 문구를 다른 언어로 다시 렌더링한다(알림함을 요청 언어로 보여 줄 때).
 * 모르는 copyKey·맞지 않는 copyFacts면 null이라 호출자는 저장한 문구를 쓴다.
 * 광고성 표기 같은 푸시 전용 장식은 붙이지 않는다.
 */
export function renderNotificationCopy(
  stored: { readonly copyKey: string; readonly copyFacts: unknown },
  locale: SupportedLocale,
): NotificationCopy | null {
  const separator = stored.copyKey.lastIndexOf(".");
  if (separator < 0) {
    return null;
  }
  const template = TEMPLATES_BY_KEY.get(stored.copyKey.slice(0, separator));
  return (
    template?.renderStored(stored.copyKey.slice(separator + 1), stored.copyFacts, locale) ?? null
  );
}
