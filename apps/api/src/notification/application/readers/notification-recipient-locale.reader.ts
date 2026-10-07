import type { SupportedLocale } from "#api/shared/domain/locale";

import type { NotificationRecipientLocaleReaderPort } from "../ports/notification-recipient-locale.reader.port.js";

/** 캐시·설정 저장소 세부사항을 숨기는 수신자 로케일 조회 capability. */
export class NotificationRecipientLocaleReader {
  constructor(private readonly localeReader: NotificationRecipientLocaleReaderPort) {}

  getRecipientLocale(userId: string): Promise<SupportedLocale> {
    return this.localeReader.getLocale(userId);
  }

  getRecipientLocales(userIds: readonly string[]): Promise<ReadonlyMap<string, SupportedLocale>> {
    return this.localeReader.getLocales(userIds);
  }
}
