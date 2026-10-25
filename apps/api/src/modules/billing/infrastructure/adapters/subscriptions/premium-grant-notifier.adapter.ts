import { Inject, Injectable } from "@nestjs/common";

import {
  createPremiumGrantEndingNotificationMessage,
  NotificationPublisher,
  NOTIFICATION_RECIPIENT_LOCALE_READER,
  type NotificationRecipientLocaleReaderPort,
  PUSH_QUIET_HOURS_READER,
  type PushQuietHoursReaderPort,
  SCHEDULER_CAMPAIGN_KEY,
} from "#api/modules/notification/notification-delivery.public";
import { DEFAULT_LOCALE } from "#api/shared/domain/locale";

import type { PremiumGrantNotifierPort } from "../../../application/ports/subscriptions/premium-grant-notifier.port.js";
import type { PremiumGrantEndingNotice } from "../../../application/ports/subscriptions/premium-grant.repository.port.js";

@Injectable()
export class PremiumGrantNotifierAdapter implements PremiumGrantNotifierPort {
  constructor(
    private readonly notificationPublisher: NotificationPublisher,
    @Inject(NOTIFICATION_RECIPIENT_LOCALE_READER)
    private readonly localeReader: NotificationRecipientLocaleReaderPort,
    @Inject(PUSH_QUIET_HOURS_READER)
    private readonly quietHoursReader: PushQuietHoursReaderPort,
  ) {}

  findUsersInQuietHours(userIds: readonly string[], at: Date): Promise<ReadonlySet<string>> {
    return this.quietHoursReader.findUsersInQuietHours(userIds, at);
  }

  async notifyEndingSoon(notices: readonly PremiumGrantEndingNotice[]): Promise<void> {
    if (notices.length === 0) return;
    const locales = await this.localeReader.getLocales(notices.map((notice) => notice.userId));
    await this.notificationPublisher.publishBatch(
      notices.map((notice) => {
        const message = createPremiumGrantEndingNotificationMessage({
          locale: locales.get(notice.userId) ?? DEFAULT_LOCALE,
        });
        return {
          userId: notice.userId,
          type: "PREMIUM_GRANT_ENDING",
          title: message.title,
          body: message.body,
          purpose: "ENGAGEMENT",
          campaignKey: SCHEDULER_CAMPAIGN_KEY.PREMIUM_GRANT_ENDING,
          variantId: message.variantId,
        };
      }),
    );
  }
}
