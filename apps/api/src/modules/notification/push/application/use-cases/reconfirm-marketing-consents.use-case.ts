import { NOTICE_DEEP_LINK_PATH, NOTIFICATION_ACTION_TYPE } from "@aido/api/vocabulary";
import { chunk } from "es-toolkit";

import {
  marketingAgreedSince,
  marketingReconfirmCutoff,
} from "#api/modules/identity/identity-settings.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { DEFAULT_DELIVERY_TIMEZONE } from "#api/shared/domain/date/utils/timezone";
import { DEFAULT_LOCALE } from "#api/shared/domain/locale";
import { instantToDate } from "#api/shared/domain/time/instant";

import type { CreateNotificationData } from "../../../inbox/application/ports/notification-draft.port.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../../reminders/domain/notification-campaign.constants.js";
import { createMarketingConsentReconfirmNotificationMessage } from "../messages/notification.messages.js";
import { NotificationDeliveryLogEvent } from "../notification-delivery.log-events.js";
import type {
  MarketingConsentReconfirmPort,
  MarketingReconfirmRecipient,
} from "../ports/marketing-consent-reconfirm.port.js";
import type { NotificationRecipientLocaleReaderPort } from "../ports/notification-recipient-locale.reader.port.js";
import type { NotificationRecipientTimezoneReaderPort } from "../ports/notification-recipient-timezone.reader.port.js";
import type { PushQuietHoursReaderPort } from "../ports/push-quiet-hours.reader.port.js";
import type { PublishNotificationUseCase } from "./publish-notification.use-case.js";

export const MARKETING_CONSENT_RECONFIRM = {
  BATCH_SIZE: 500,
  /** 표시와 알림 기록을 한 트랜잭션에 남기는 수 */
  CLAIM_CHUNK_SIZE: 100,
  // job 만료 안에 끝나도록 상한을 두고 남은 사용자는 다음 실행이 이어 받는다
  MAX_BATCHES_PER_RUN: 20,
} as const;

export interface ReconfirmMarketingConsentsInput {
  readonly now: Temporal.Instant;
}

export interface ReconfirmMarketingConsentsResult {
  readonly notifiedCount: number;
  readonly hasRemaining: boolean;
}

interface ReconfirmMarketingConsentsDependencies {
  readonly reconfirmAccess: MarketingConsentReconfirmPort;
  readonly localeReader: Pick<NotificationRecipientLocaleReaderPort, "getLocales">;
  readonly timezoneReader: NotificationRecipientTimezoneReaderPort;
  readonly quietHoursReader: Pick<PushQuietHoursReaderPort, "findUsersInQuietHours">;
  readonly notificationPublisher: Pick<PublishNotificationUseCase, "publishBatch">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/**
 * 광고성 정보 수신에 동의한 지(또는 마지막으로 알린 지) 2년이 지난 사용자에게 동의 사실을 한 번 알린다
 * (정보통신망법 시행령 제62조). 거래 정보라 광고성 동의 없이 알림함과 푸시로 보낸다.
 * 현지 야간(21:00–08:00)인 사용자는 표시하지 않고 남겨 낮 시간 실행이 보낸다. 표시한 뒤 야간 설정으로
 * 푸시가 빠지면 2년 동안 다시 알리지 않기 때문이다. 표시는 조건부 UPDATE라 두 실행이 겹쳐도 한 번만 보낸다.
 */
export class ReconfirmMarketingConsentsUseCase {
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
      const quietUserIds = await this.#dependencies.quietHoursReader.findUsersInQuietHours(
        targets.map((target) => target.userId),
        instantToDate(input.now),
      );
      const daytimeUserIds = targets
        .map((target) => target.userId)
        .filter((userId) => !quietUserIds.has(userId));
      for (const userIds of chunk(daytimeUserIds, MARKETING_CONSENT_RECONFIRM.CLAIM_CHUNK_SIZE)) {
        notifiedCount += await this.#claimAndNotify(userIds, cutoff, input.now);
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

  async #claimAndNotify(
    userIds: readonly string[],
    cutoff: Temporal.Instant,
    now: Temporal.Instant,
  ): Promise<number> {
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
    const message = createMarketingConsentReconfirmNotificationMessage({
      ...context,
      agreedAt: instantToDate(agreedAt),
    });
    return [
      {
        userId: recipient.userId,
        type: "SYSTEM_NOTICE",
        title: message.title,
        body: message.body,
        copyKey: message.copyKey,
        copyFacts: message.copyFacts,
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
