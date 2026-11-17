import { NOTICE_DEEP_LINK_PATH, NOTIFICATION_ACTION_TYPE } from "@aido/api/vocabulary";
import { Inject, Injectable } from "@nestjs/common";

import {
  createPremiumTrialEndingNotificationMessage,
  PublishNotificationBatchUseCase,
  SCHEDULER_CAMPAIGN_KEY,
} from "#api/modules/notification/notifications/notification-notifications.public";
import {
  NotificationRecipientLocaleReaderPort,
  NotificationRecipientTimezoneReaderPort,
} from "#api/modules/notification/push-dispatches/notification-push-dispatches.public";
import { DEFAULT_LOCALE } from "#api/shared/domain/locale";
import { instantToDate } from "#api/shared/domain/time/instant";
import { DEFAULT_DELIVERY_TIMEZONE } from "#api/shared/domain/time/time-zone-name";

import type { TrialEndingNotifierPort } from "../../application/ports/trial-ending-notifier.port.js";
import type { TrialEndingNotice } from "../../domain/trial-ending-notice.entity.js";

@Injectable()
export class TrialEndingNotifierAdapter implements TrialEndingNotifierPort {
  readonly #notificationPublisher: PublishNotificationBatchUseCase;
  readonly #localeReader: NotificationRecipientLocaleReaderPort;
  readonly #timezoneReader: NotificationRecipientTimezoneReaderPort;

  constructor(
    notificationPublisher: PublishNotificationBatchUseCase,
    @Inject(NotificationRecipientLocaleReaderPort)
    localeReader: NotificationRecipientLocaleReaderPort,
    @Inject(NotificationRecipientTimezoneReaderPort)
    timezoneReader: NotificationRecipientTimezoneReaderPort,
  ) {
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
      this.#localeReader.getLocales(userIds),
      this.#timezoneReader.getTimezones(userIds.map((userId) => userId.value)),
    ]);
    await this.#notificationPublisher.execute(
      notices.map((notice) => {
        const message = createPremiumTrialEndingNotificationMessage({
          locale: locales.get(notice.userId.value) ?? DEFAULT_LOCALE,
          timezone: timezones.get(notice.userId.value) ?? DEFAULT_DELIVERY_TIMEZONE,
          endsAt: instantToDate(notice.expiresAt),
          now: instantToDate(now),
          willRenew: notice.willRenew,
          planType: notice.planType,
          variantContext: {
            campaignKey: SCHEDULER_CAMPAIGN_KEY.PREMIUM_TRIAL_ENDING,
            recipientId: notice.userId.value,
            occurrenceKey: String(notice.id.value),
          },
        });
        return {
          userId: notice.userId.value,
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
          metadata: { subscriptionId: notice.id.value, willRenew: notice.willRenew },
        };
      }),
    );
  }
}
