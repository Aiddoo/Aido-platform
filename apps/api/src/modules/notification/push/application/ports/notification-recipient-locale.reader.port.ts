import type { SupportedLocale } from "@aido/api/vocabulary";

// 다른 Context가 옮길 때까지 옛 Symbol을 같은 인스턴스의 별칭으로 남긴다
export const NOTIFICATION_RECIPIENT_LOCALE_READER = Symbol("NOTIFICATION_RECIPIENT_LOCALE_READER");

// 알림 문구를 고를 수신자 언어. 결정 규칙은 resolveRecipientLocale 하나다
export abstract class NotificationRecipientLocaleReaderPort {
  abstract getLocale(userId: string): Promise<SupportedLocale>;
  abstract getLocales(userIds: readonly string[]): Promise<ReadonlyMap<string, SupportedLocale>>;
}
