import { NOTICE_DEEP_LINK_PATH, NOTIFICATION_ACTION_TYPE } from "@aido/api/vocabulary";
import { Inject, Injectable } from "@nestjs/common";

import {
  createPremiumRenewalUpcomingNotificationMessage,
  NotificationPublisher,
  NOTIFICATION_RECIPIENT_LOCALE_READER,
  NOTIFICATION_RECIPIENT_TIMEZONE_READER,
  type NotificationRecipientLocaleReaderPort,
  type NotificationRecipientTimezoneReaderPort,
  SCHEDULER_CAMPAIGN_KEY,
} from "#api/modules/notification/notification-delivery.public";
import { DEFAULT_DELIVERY_TIMEZONE } from "#api/shared/domain/date/utils/timezone";
import { DEFAULT_LOCALE } from "#api/shared/domain/locale";

import type { UpcomingRenewalNotice } from "../../application/ports/upcoming-renewal-notice.repository.port.js";
import type { UpcomingRenewalNotifierPort } from "../../application/ports/upcoming-renewal-notifier.port.js";

@Injectable()
export class UpcomingRenewalNotifierAdapter implements UpcomingRenewalNotifierPort {
  readonly #notificationPublisher: NotificationPublisher;
  readonly #localeReader: NotificationRecipientLocaleReaderPort;
  readonly #timezoneReader: NotificationRecipientTimezoneReaderPort;

  constructor(
    notificationPublisher: NotificationPublisher,
    @Inject(NOTIFICATION_RECIPIENT_LOCALE_READER)
    localeReader: NotificationRecipientLocaleReaderPort,
    @Inject(NOTIFICATION_RECIPIENT_TIMEZONE_READER)
    timezoneReader: NotificationRecipientTimezoneReaderPort,
  ) {
    this.#notificationPublisher = notificationPublisher;
    this.#localeReader = localeReader;
    this.#timezoneReader = timezoneReader;
  }

  async notify(notices: readonly UpcomingRenewalNotice[], now: Date): Promise<void> {
    if (notices.length === 0) {
      return;
    }
    const userIds = notices.map((notice) => notice.userId);
    const [locales, timezones] = await Promise.all([
      this.#localeReader.getLocales(userIds),
      this.#timezoneReader.getTimezones(userIds),
    ]);
    await this.#notificationPublisher.publishBatch(
      notices.map((notice) => {
        const message = createPremiumRenewalUpcomingNotificationMessage({
          locale: locales.get(notice.userId) ?? DEFAULT_LOCALE,
          timezone: timezones.get(notice.userId) ?? DEFAULT_DELIVERY_TIMEZONE,
          renewsAt: notice.expiresAt,
          now,
          variantContext: {
            campaignKey: SCHEDULER_CAMPAIGN_KEY.PREMIUM_RENEWAL_UPCOMING,
            recipientId: notice.userId,
            occurrenceKey: `${notice.subscriptionId}:${notice.expiresAt.getTime()}`,
          },
        });
        return {
          userId: notice.userId,
          type: "PREMIUM_RENEWAL_UPCOMING",
          title: message.title,
          body: message.body,
          // 다음 결제 예정은 거래 정보라 광고성 동의 없이 보낸다
          purpose: "TRANSACTIONAL",
          campaignKey: SCHEDULER_CAMPAIGN_KEY.PREMIUM_RENEWAL_UPCOMING,
          variantId: message.variantId,
          // 앱에는 SYSTEM_NOTICE로 가므로 1.13.0+ 앱이 이 경로로 구독 화면을 연다
          action: {
            type: NOTIFICATION_ACTION_TYPE.DEEP_LINK,
            url: NOTICE_DEEP_LINK_PATH.SUBSCRIPTION,
          },
          metadata: { subscriptionId: notice.subscriptionId },
        };
      }),
    );
  }
}
