import { NOTICE_DEEP_LINK_PATH, NOTIFICATION_ACTION_TYPE } from "@aido/api/vocabulary";
import { Inject, Injectable } from "@nestjs/common";

import {
  createPremiumTrialEndingNotificationMessage,
  NotificationPublisher,
  NotificationRecipientLocaleReaderPort,
  NotificationRecipientTimezoneReaderPort,
  SCHEDULER_CAMPAIGN_KEY,
} from "#api/modules/notification/notification-delivery.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { DEFAULT_LOCALE } from "#api/shared/domain/locale";
import { instantToDate } from "#api/shared/domain/time/instant";
import { DEFAULT_DELIVERY_TIMEZONE } from "#api/shared/domain/time/time-zone-name";

import type { TrialEndingNotice } from "../../application/ports/trial-ending-notice.repository.port.js";
import { TrialEndingNotifierPort } from "../../application/ports/trial-ending-notifier.port.js";

@Injectable()
export class TrialEndingNotifierAdapter extends TrialEndingNotifierPort {
  readonly #notificationPublisher: NotificationPublisher;
  readonly #localeReader: NotificationRecipientLocaleReaderPort;
  readonly #timezoneReader: NotificationRecipientTimezoneReaderPort;

  constructor(
    notificationPublisher: NotificationPublisher,
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

  async notify(notices: readonly TrialEndingNotice[], now: Temporal.Instant): Promise<void> {
    if (notices.length === 0) {
      return;
    }
    const userIds = notices.map((notice) => notice.userId);
    const [locales, timezones] = await Promise.all([
      this.#localeReader.getLocales(userIds.map((userId) => UserId.reconstitute(userId))),
      this.#timezoneReader.getTimezones(userIds),
    ]);
    await this.#notificationPublisher.publishBatch(
      notices.map((notice) => {
        const message = createPremiumTrialEndingNotificationMessage({
          locale: locales.get(notice.userId) ?? DEFAULT_LOCALE,
          timezone: timezones.get(notice.userId) ?? DEFAULT_DELIVERY_TIMEZONE,
          endsAt: instantToDate(notice.expiresAt),
          now: instantToDate(now),
          willRenew: notice.willRenew,
          planType: notice.planType,
          variantContext: {
            campaignKey: SCHEDULER_CAMPAIGN_KEY.PREMIUM_TRIAL_ENDING,
            recipientId: notice.userId,
            occurrenceKey: String(notice.subscriptionId),
          },
        });
        return {
          userId: notice.userId,
          type: "PREMIUM_TRIAL_ENDING",
          title: message.title,
          body: message.body,
          // 결제 예정·체험 종료는 거래 정보라 광고성 동의 없이 보낸다
          purpose: "TRANSACTIONAL",
          campaignKey: SCHEDULER_CAMPAIGN_KEY.PREMIUM_TRIAL_ENDING,
          variantId: message.variantId,
          // 앱에는 SYSTEM_NOTICE로 가므로 1.13.0+ 앱이 이 경로로 구독 화면을 연다
          action: {
            type: NOTIFICATION_ACTION_TYPE.DEEP_LINK,
            url: NOTICE_DEEP_LINK_PATH.SUBSCRIPTION,
          },
          metadata: { subscriptionId: notice.subscriptionId, willRenew: notice.willRenew },
        };
      }),
    );
  }
}
