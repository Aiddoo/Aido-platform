import { Inject, Injectable } from "@nestjs/common";

import {
  createPremiumGrantEndingNotificationMessage,
  PublishNotificationUseCase,
  NotificationRecipientLocaleReaderPort,
  SCHEDULER_CAMPAIGN_KEY,
} from "#api/modules/notification/notification-delivery.public";
import { DEFAULT_LOCALE } from "#api/shared/domain/locale";

import { PremiumGrantNotifierPort } from "../../application/ports/premium-grant-notifier.port.js";
import type { PremiumGrantEndingNotice } from "../../domain/premium-grant-ending-notice.entity.js";

@Injectable()
export class PremiumGrantNotifierAdapter extends PremiumGrantNotifierPort {
  readonly #notificationPublisher: PublishNotificationUseCase;
  readonly #localeReader: NotificationRecipientLocaleReaderPort;

  constructor(
    notificationPublisher: PublishNotificationUseCase,
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
    const locales = await this.#localeReader.getLocales(notices.map((notice) => notice.userId));
    await this.#notificationPublisher.publishBatch(
      notices.map((notice) => {
        const message = createPremiumGrantEndingNotificationMessage({
          locale: locales.get(notice.userId.value) ?? DEFAULT_LOCALE,
        });
        return {
          userId: notice.userId.value,
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
