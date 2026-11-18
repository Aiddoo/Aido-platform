import { Inject, Injectable } from "@nestjs/common";

import {
  type UserConsentReadModel,
  UserNotificationSettingsAccessPort,
  type UserPreferenceReadModel,
} from "#api/modules/identity/user-preferences/identity-user-preferences.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  NotificationDeliveryPreferenceWithUserId,
  NotificationMarketingConsentWithUserId,
  UserNotificationSettingsPort,
} from "../../../shared/application/ports/user-notification-settings.port.js";

/**
 * notification의 설정 포트를 user-settings의 공개 capability에 연결한다.
 */
@Injectable()
export class UserNotificationSettingsAdapter implements UserNotificationSettingsPort {
  readonly #userSettingsAccess: UserNotificationSettingsAccessPort;

  constructor(
    @Inject(UserNotificationSettingsAccessPort)
    userSettingsAccess: UserNotificationSettingsAccessPort,
  ) {
    this.#userSettingsAccess = userSettingsAccess;
  }

  upsertPushTimezone(userId: UserId, timezone: string): Promise<void> {
    return this.#userSettingsAccess.upsertPushTimezone(userId, timezone);
  }

  upsertPushLocale(userId: UserId, locale: string): Promise<void> {
    return this.#userSettingsAccess.upsertPushLocale(userId, locale);
  }

  findPreferenceReadModel(userId: UserId): Promise<UserPreferenceReadModel | null> {
    return this.#userSettingsAccess.findPreferenceReadModel(userId);
  }

  async findPreferenceReadModelsByUserIds(
    userIds: readonly UserId[],
  ): Promise<NotificationDeliveryPreferenceWithUserId[]> {
    const preferences = await this.#userSettingsAccess.findPreferenceReadModelsByUserIds(userIds);
    return preferences.map((preference) => ({
      ...preference,
      userId: UserId.reconstitute(preference.userId),
    }));
  }

  findConsentReadModel(userId: UserId): Promise<UserConsentReadModel | null> {
    return this.#userSettingsAccess.findConsentReadModel(userId);
  }

  async findConsentReadModelsByUserIds(
    userIds: readonly UserId[],
  ): Promise<NotificationMarketingConsentWithUserId[]> {
    const consents = await this.#userSettingsAccess.findConsentReadModelsByUserIds(userIds);
    return consents.map((consent) => ({ ...consent, userId: UserId.reconstitute(consent.userId) }));
  }

  async updateMarketingPushConsent(userId: UserId, agreed: boolean): Promise<void> {
    await this.#userSettingsAccess.updateMarketingPushConsent(userId, agreed);
  }
}
