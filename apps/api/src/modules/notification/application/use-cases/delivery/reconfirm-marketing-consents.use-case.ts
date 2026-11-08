import { NOTICE_DEEP_LINK_PATH, NOTIFICATION_ACTION_TYPE } from "@aido/api/vocabulary";
import { chunk } from "es-toolkit";

import {
  marketingAgreedSince,
  marketingReconfirmCutoff,
} from "#api/modules/identity/identity-settings.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { DEFAULT_DELIVERY_TIMEZONE } from "#api/shared/domain/date/utils/timezone";
import { DEFAULT_LOCALE } from "#api/shared/domain/locale";

import { SCHEDULER_CAMPAIGN_KEY } from "../../../domain/services/reminders/notification-campaign.js";
import { createMarketingConsentReconfirmNotificationMessage } from "../../messages/delivery/notification-messages.js";
import { NotificationDeliveryLogEvent } from "../../observability/delivery/notification-delivery-log.events.js";
import type {
  MarketingConsentReconfirmPort,
  MarketingReconfirmRecipient,
} from "../../ports/delivery/marketing-consent-reconfirm.port.js";
import type { CreateNotificationData } from "../../ports/delivery/notification-data.js";
import type { NotificationRecipientLocaleReaderPort } from "../../ports/delivery/notification-recipient-locale.reader.port.js";
import type { NotificationRecipientTimezoneReaderPort } from "../../ports/delivery/notification-recipient-timezone.reader.port.js";
import type { NotificationPublisher } from "../../publishers/delivery/notification.publisher.js";

export const MARKETING_CONSENT_RECONFIRM = {
  BATCH_SIZE: 500,
  /** 표시와 알림 기록을 한 트랜잭션에 남기는 수 */
  CLAIM_CHUNK_SIZE: 100,
  // job 만료 안에 끝나도록 상한을 두고 남은 사용자는 다음 실행이 이어 받는다
  MAX_BATCHES_PER_RUN: 20,
} as const;

export interface ReconfirmMarketingConsentsInput {
  readonly now: Date;
}

export interface ReconfirmMarketingConsentsResult {
  readonly notifiedCount: number;
  readonly hasRemaining: boolean;
}

interface ReconfirmMarketingConsentsDependencies {
  readonly reconfirmAccess: MarketingConsentReconfirmPort;
  readonly localeReader: Pick<NotificationRecipientLocaleReaderPort, "getLocales">;
  readonly timezoneReader: NotificationRecipientTimezoneReaderPort;
  readonly notificationPublisher: Pick<NotificationPublisher, "publishBatch">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: Pick<ApplicationLogger, "log">;
}

/**
 * 광고성 정보 수신에 동의한 지(또는 마지막으로 알린 지) 2년이 지난 사용자에게 동의 사실을 한 번 알린다
 * (정보통신망법 시행령 제62조). 거래 정보라 광고성 동의·야간 광고 제한 없이 알림함과 푸시로 보낸다.
 * 표시는 조건부 UPDATE라 두 실행이 겹쳐도 한 번만 보낸다.
 */
export class ReconfirmMarketingConsents {
  readonly #dependencies: ReconfirmMarketingConsentsDependencies;

  constructor(dependencies: ReconfirmMarketingConsentsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ReconfirmMarketingConsentsInput): Promise<ReconfirmMarketingConsentsResult> {
    const cutoff = marketingReconfirmCutoff(input.now);
    let afterUserId: string | undefined;
    let notifiedCount = 0;
    let hasRemaining = false;

    for (let batch = 0; batch < MARKETING_CONSENT_RECONFIRM.MAX_BATCHES_PER_RUN; batch++) {
      const targets = await this.#dependencies.reconfirmAccess.findMarketingReconfirmTargets({
        cutoff,
        ...(afterUserId != null && { afterUserId }),
        limit: MARKETING_CONSENT_RECONFIRM.BATCH_SIZE,
      });
      for (const users of chunk(targets, MARKETING_CONSENT_RECONFIRM.CLAIM_CHUNK_SIZE)) {
        notifiedCount += await this.#claimAndNotify(
          users.map((target) => target.userId),
          cutoff,
          input.now,
        );
      }
      hasRemaining = targets.length === MARKETING_CONSENT_RECONFIRM.BATCH_SIZE;
      if (!hasRemaining) {
        break;
      }
      afterUserId = targets.at(-1)?.userId;
    }

    this.#dependencies.logger.log({
      event: NotificationDeliveryLogEvent.MARKETING_CONSENT_RECONFIRMED,
      notifiedCount,
      hasRemaining,
    });
    return { notifiedCount, hasRemaining };
  }

  async #claimAndNotify(userIds: readonly string[], cutoff: Date, now: Date): Promise<number> {
    const [locales, timezones] = await Promise.all([
      this.#dependencies.localeReader.getLocales(userIds),
      this.#dependencies.timezoneReader.getTimezones(userIds),
    ]);
    return this.#dependencies.unitOfWork.run(async () => {
      const claimed = await this.#dependencies.reconfirmAccess.claimMarketingReconfirm(userIds, {
        cutoff,
        at: now,
      });
      const notices = claimed.flatMap((recipient) =>
        this.#notice(recipient, {
          locale: locales.get(recipient.userId) ?? DEFAULT_LOCALE,
          timezone: timezones.get(recipient.userId) ?? DEFAULT_DELIVERY_TIMEZONE,
        }),
      );
      if (notices.length > 0) {
        await this.#dependencies.notificationPublisher.publishBatch(notices);
      }
      return notices.length;
    });
  }

  #notice(
    recipient: MarketingReconfirmRecipient,
    context: Pick<
      Parameters<typeof createMarketingConsentReconfirmNotificationMessage>[0],
      "locale" | "timezone"
    >,
  ): CreateNotificationData[] {
    const agreedAt = marketingAgreedSince(recipient);
    if (agreedAt == null) {
      return [];
    }
    const message = createMarketingConsentReconfirmNotificationMessage({ ...context, agreedAt });
    return [
      {
        userId: recipient.userId,
        type: "SYSTEM_NOTICE",
        title: message.title,
        body: message.body,
        // 동의 사실을 알리는 법정 고지라 광고성 동의 없이 보낸다
        purpose: "TRANSACTIONAL",
        campaignKey: SCHEDULER_CAMPAIGN_KEY.MARKETING_CONSENT_RECONFIRM,
        action: {
          type: NOTIFICATION_ACTION_TYPE.DEEP_LINK,
          url: NOTICE_DEEP_LINK_PATH.NOTIFICATION_SETTINGS,
        },
        metadata: { notice: "MARKETING_CONSENT_RECONFIRM" },
      },
    ];
  }
}
