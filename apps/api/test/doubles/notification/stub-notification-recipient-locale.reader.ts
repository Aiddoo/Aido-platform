import type { SupportedLocale } from "@aido/api/vocabulary";

import { NotificationRecipientLocaleReaderPort } from "#api/modules/notification/push/application/ports/notification-recipient-locale.reader.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 모든 수신자에게 정해 둔 언어 하나로 답한다
export class StubNotificationRecipientLocaleReader extends NotificationRecipientLocaleReaderPort {
  locale: SupportedLocale = "ko";

  async getLocale(): Promise<SupportedLocale> {
    return this.locale;
  }

  async getLocales(users: readonly UserId[]): Promise<ReadonlyMap<string, SupportedLocale>> {
    const userIds = users.map((user) => user.value);
    return new Map(userIds.map((userId) => [userId, this.locale]));
  }
}
