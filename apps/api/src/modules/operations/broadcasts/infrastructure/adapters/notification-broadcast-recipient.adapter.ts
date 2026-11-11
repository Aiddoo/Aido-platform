import { DEFAULT_LOCALE } from "@aido/api/vocabulary";
import { Inject, Injectable } from "@nestjs/common";

import {
  NotificationRecipientLocaleReaderPort,
  NotificationRecipientTimezoneReaderPort,
} from "#api/modules/notification/notification-delivery.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { TimeZone } from "#api/shared/domain/time/time-zone.vo";

import { BroadcastRecipientReaderPort } from "../../application/ports/broadcast-recipient.reader.port.js";
import type { BroadcastRecipient } from "../../application/read-models/broadcast-recipient.read-model.js";

// 알림 카피 언어와 발송 판단 시간대는 notification이 소유한다. 같은 판단을 써서 푸시와 어긋나지 않게 한다
@Injectable()
export class NotificationBroadcastRecipientAdapter extends BroadcastRecipientReaderPort {
  readonly #localeReader: NotificationRecipientLocaleReaderPort;
  readonly #timezoneReader: NotificationRecipientTimezoneReaderPort;

  constructor(
    @Inject(NotificationRecipientLocaleReaderPort)
    localeReader: NotificationRecipientLocaleReaderPort,
    @Inject(NotificationRecipientTimezoneReaderPort)
    timezoneReader: NotificationRecipientTimezoneReaderPort,
  ) {
    super();
    this.#localeReader = localeReader;
    this.#timezoneReader = timezoneReader;
  }

  async listRecipients(
    userIds: readonly UserId[],
  ): Promise<ReadonlyMap<string, BroadcastRecipient>> {
    const ids = userIds.map((userId) => userId.value);
    const [locales, timezones] = await Promise.all([
      this.#localeReader.getLocales(ids.map((userId) => UserId.reconstitute(userId))),
      this.#timezoneReader.getTimezones(ids),
    ]);
    return new Map(
      ids.map((id) => [
        id,
        {
          locale: locales.get(id) ?? DEFAULT_LOCALE,
          timeZone: TimeZone.reconstitute(timezones.get(id) ?? TimeZone.SEOUL.value),
        },
      ]),
    );
  }
}
