import { uniq } from "es-toolkit";

import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { localDateIn, resolveDeliveryTimezone } from "#api/shared/domain/time/time-zone-name";

import type {
  NotificationDeliveryPreference,
  NotificationMarketingConsent,
  UserNotificationSettingsPort,
} from "../../../shared/application/ports/user-notification-settings.port.js";

export interface BatchPushDeliveryRecipient {
  readonly userId: string;
  readonly preference: NotificationDeliveryPreference | undefined;
  readonly consent: NotificationMarketingConsent | undefined;
  readonly timezone: string;
  // 발송 판단의 현지 날짜(YYYY-MM-DD)는 rate limit·발송 context 키로 쓴다
  readonly localDate: string;
}

interface LoadPushDeliveryRecipientsDependencies {
  readonly userSettings: Pick<
    UserNotificationSettingsPort,
    "findConsentReadModelsByUserIds" | "findPreferenceReadModelsByUserIds"
  >;
  readonly clock: ClockPort;
}

// 배치 발송은 받는 사람 설정·동의를 한 번에 읽는다
export class LoadPushDeliveryRecipientsUseCase {
  readonly #dependencies: LoadPushDeliveryRecipientsDependencies;

  constructor(dependencies: LoadPushDeliveryRecipientsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, BatchPushDeliveryRecipient>> {
    const uniqueUserIds = uniq(userIds);
    const recipientIds = uniqueUserIds.map((userId) => UserId.reconstitute(userId));
    const [preferences, consents] = await Promise.all([
      this.#dependencies.userSettings.findPreferenceReadModelsByUserIds(recipientIds),
      this.#dependencies.userSettings.findConsentReadModelsByUserIds(recipientIds),
    ]);
    const preferenceByUserId = new Map(
      preferences.map((preference) => [preference.userId, preference]),
    );
    const consentByUserId = new Map(consents.map((consent) => [consent.userId, consent]));
    const now = this.#dependencies.clock.now();

    return new Map(
      uniqueUserIds.map((userId) => {
        const preference = preferenceByUserId.get(userId);
        const timezone = resolveDeliveryTimezone(preference?.timezone);
        return [
          userId,
          {
            userId,
            preference,
            consent: consentByUserId.get(userId),
            timezone,
            localDate: localDateIn(now, timezone).toString(),
          },
        ];
      }),
    );
  }
}
