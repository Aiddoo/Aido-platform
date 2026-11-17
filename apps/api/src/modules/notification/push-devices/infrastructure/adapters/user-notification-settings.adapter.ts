import { Inject, Injectable } from "@nestjs/common";

import {
  type UserConsentReadModel,
  UserNotificationSettingsAccessPort,
  type UserPreferenceReadModel,
} from "#api/modules/identity/user-preferences/identity-user-preferences.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserNotificationSettingsPort } from "../../../shared/application/ports/user-notification-settings.port.js";

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

  findPreferenceReadModelsByUserIds(
    userIds: readonly UserId[],
  ): Promise<UserPreferenceReadModel[]> {
    return this.#userSettingsAccess.findPreferenceReadModelsByUserIds(userIds);
  }

  findConsentReadModel(userId: UserId): Promise<UserConsentReadModel | null> {
    return this.#userSettingsAccess.findConsentReadModel(userId);
  }

  findConsentReadModelsByUserIds(userIds: readonly UserId[]): Promise<UserConsentReadModel[]> {
    return this.#userSettingsAccess.findConsentReadModelsByUserIds(userIds);
  }

  async updateMarketingPushConsent(userId: UserId, agreed: boolean): Promise<void> {
    await this.#userSettingsAccess.updateMarketingPushConsent(userId, agreed);
  }
}
