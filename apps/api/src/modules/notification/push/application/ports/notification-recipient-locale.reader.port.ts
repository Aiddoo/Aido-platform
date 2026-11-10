import type { SupportedLocale } from "@aido/api/vocabulary";

// 알림 문구를 고를 수신자 언어. 결정 규칙은 resolveRecipientLocale 하나다
export abstract class NotificationRecipientLocaleReaderPort {
  abstract getLocale(userId: string): Promise<SupportedLocale>;
  abstract getLocales(userIds: readonly string[]): Promise<ReadonlyMap<string, SupportedLocale>>;
}
