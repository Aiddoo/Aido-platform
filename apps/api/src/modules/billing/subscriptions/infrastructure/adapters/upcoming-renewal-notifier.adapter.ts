import { NOTICE_DEEP_LINK_PATH, NOTIFICATION_ACTION_TYPE } from "@aido/api/vocabulary";
import { Inject, Injectable } from "@nestjs/common";

import {
  createPremiumRenewalUpcomingNotificationMessage,
  PublishNotificationUseCase,
  NotificationRecipientLocaleReaderPort,
  NotificationRecipientTimezoneReaderPort,
  SCHEDULER_CAMPAIGN_KEY,
} from "#api/modules/notification/notification-delivery.public";
import { DEFAULT_LOCALE } from "#api/shared/domain/locale";
import { instantToDate } from "#api/shared/domain/time/instant";
import { DEFAULT_DELIVERY_TIMEZONE } from "#api/shared/domain/time/time-zone-name";

import { UpcomingRenewalNotifierPort } from "../../application/ports/upcoming-renewal-notifier.port.js";
import type { UpcomingRenewalNotice } from "../../domain/upcoming-renewal-notice.entity.js";

@Injectable()
export class UpcomingRenewalNotifierAdapter extends UpcomingRenewalNotifierPort {
  readonly #notificationPublisher: PublishNotificationUseCase;
  readonly #localeReader: NotificationRecipientLocaleReaderPort;
  readonly #timezoneReader: NotificationRecipientTimezoneReaderPort;

  constructor(
    notificationPublisher: PublishNotificationUseCase,
    @Inject(NotificationRecipientLocaleReaderPort)
    localeReader: NotificationRecipientLocaleReaderPort,
    @Inject(NotificationRecipientTimezoneReaderPort)
    timezoneReader: NotificationRecipientTimezoneReaderPort,
  ) {
    super();
    this.#notificationPublisher = notificationPublisher;
    this.#localeReader = localeReader;
    this.#timezoneReader = timezoneReader;
  }

  async notify(notices: readonly UpcomingRenewalNotice[], now: Temporal.Instant): Promise<void> {
    if (notices.length === 0) {
      return;
    }
    const userIds = notices.map((notice) => notice.userId);
    const [locales, timezones] = await Promise.all([
      this.#localeReader.getLocales(userIds),
      this.#timezoneReader.getTimezones(userIds.map((userId) => userId.value)),
    ]);
    await this.#notificationPublisher.publishBatch(
      notices.map((notice) => {
        const message = createPremiumRenewalUpcomingNotificationMessage({
          locale: locales.get(notice.userId.value) ?? DEFAULT_LOCALE,
          timezone: timezones.get(notice.userId.value) ?? DEFAULT_DELIVERY_TIMEZONE,
          renewsAt: instantToDate(notice.expiresAt),
          now: instantToDate(now),
          variantContext: {
            campaignKey: SCHEDULER_CAMPAIGN_KEY.PREMIUM_RENEWAL_UPCOMING,
            recipientId: notice.userId.value,
            // 문자열은 배포 전 안내와 같은 변형 배정을 유지하려고 만료 시각 ms를 쓴다
            occurrenceKey: `${notice.id.value}:${notice.expiresAt.epochMilliseconds}`,
          },
        });
        return {
          userId: notice.userId.value,
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
          metadata: { subscriptionId: notice.id.value },
        };
      }),
    );
  }
}
