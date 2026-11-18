import type { SupportedLocale } from "@aido/api/vocabulary";

import { NotificationRecipientLocaleReaderPort } from "#api/modules/notification/push-dispatches/application/ports/notification-recipient-locale.reader.port";
import type { RecipientLocaleOf } from "#api/modules/notification/shared/domain/recipient-locale.domain-service";

// 모든 수신자에게 정해 둔 언어 하나로 답한다
export class StubNotificationRecipientLocaleReader extends NotificationRecipientLocaleReaderPort {
  locale: SupportedLocale = "ko";

  async getLocale(): Promise<SupportedLocale> {
    return this.locale;
  }

  async getLocales(): Promise<RecipientLocaleOf> {
    const { locale } = this;
    return () => locale;
  }
}
