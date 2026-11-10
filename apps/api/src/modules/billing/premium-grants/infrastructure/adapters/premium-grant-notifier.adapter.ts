import { Inject, Injectable } from "@nestjs/common";

import {
  createPremiumGrantEndingNotificationMessage,
  NotificationPublisher,
  NotificationRecipientLocaleReaderPort,
  SCHEDULER_CAMPAIGN_KEY,
} from "#api/modules/notification/notification-delivery.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { DEFAULT_LOCALE } from "#api/shared/domain/locale";

import type { PremiumGrantEndingNotice } from "../../application/ports/premium-grant-ending-notice.repository.port.js";
import { PremiumGrantNotifierPort } from "../../application/ports/premium-grant-notifier.port.js";

@Injectable()
export class PremiumGrantNotifierAdapter extends PremiumGrantNotifierPort {
  readonly #notificationPublisher: NotificationPublisher;
  readonly #localeReader: NotificationRecipientLocaleReaderPort;

  constructor(
    notificationPublisher: NotificationPublisher,
    @Inject(NotificationRecipientLocaleReaderPort)
    localeReader: NotificationRecipientLocaleReaderPort,
  ) {
    super();
    this.#notificationPublisher = notificationPublisher;
    this.#localeReader = localeReader;
  }

  async notify(notices: readonly PremiumGrantEndingNotice[]): Promise<void> {
    if (notices.length === 0) {
      return;
    }
    const locales = await this.#localeReader.getLocales(
      notices.map((notice) => UserId.reconstitute(notice.userId)),
    );
    await this.#notificationPublisher.publishBatch(
      notices.map((notice) => {
        const message = createPremiumGrantEndingNotificationMessage({
          locale: locales.get(notice.userId) ?? DEFAULT_LOCALE,
        });
        return {
          userId: notice.userId,
          type: "PREMIUM_GRANT_ENDING",
          title: message.title,
          body: message.body,
          // 받고 있는 보상 기간이 끝난다는 거래 정보라 광고성 동의 없이 보낸다
          purpose: "TRANSACTIONAL",
          campaignKey: SCHEDULER_CAMPAIGN_KEY.PREMIUM_GRANT_ENDING,
          variantId: message.variantId,
        };
      }),
    );
  }
}
