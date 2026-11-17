import { Inject, Injectable } from "@nestjs/common";

import {
  createPremiumGrantEndingNotificationMessage,
  PublishNotificationBatchUseCase,
  SCHEDULER_CAMPAIGN_KEY,
} from "#api/modules/notification/notifications/notification-notifications.public";
import { NotificationRecipientLocaleReaderPort } from "#api/modules/notification/push-dispatches/notification-push-dispatches.public";

import type { PremiumGrantNotifierPort } from "../../application/ports/premium-grant-notifier.port.js";
import type { PremiumGrantEndingNotice } from "../../domain/premium-grant-ending-notice.entity.js";

@Injectable()
export class PremiumGrantNotifierAdapter implements PremiumGrantNotifierPort {
  readonly #notificationPublisher: PublishNotificationBatchUseCase;
  readonly #localeReader: NotificationRecipientLocaleReaderPort;

  constructor(
    notificationPublisher: PublishNotificationBatchUseCase,
    @Inject(NotificationRecipientLocaleReaderPort)
    localeReader: NotificationRecipientLocaleReaderPort,
  ) {
    this.#notificationPublisher = notificationPublisher;
    this.#localeReader = localeReader;
  }

  async notify(notices: readonly PremiumGrantEndingNotice[]): Promise<void> {
    if (notices.length === 0) {
      return;
    }
    const localeOf = await this.#localeReader.getLocales(notices.map((notice) => notice.userId));
    await this.#notificationPublisher.execute(
      notices.map((notice) => {
        const message = createPremiumGrantEndingNotificationMessage({
          locale: localeOf(notice.userId.value),
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
