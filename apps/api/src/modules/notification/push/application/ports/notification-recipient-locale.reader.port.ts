import type { SupportedLocale } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 알림 문구를 고를 수신자 언어. 결정 규칙은 resolveRecipientLocale 하나다
export abstract class NotificationRecipientLocaleReaderPort {
  abstract getLocale(userId: UserId): Promise<SupportedLocale>;
  abstract getLocales(userIds: readonly UserId[]): Promise<ReadonlyMap<string, SupportedLocale>>;
}
