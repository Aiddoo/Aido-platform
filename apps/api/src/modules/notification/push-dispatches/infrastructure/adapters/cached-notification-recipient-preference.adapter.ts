import type { SupportedLocale } from "@aido/api/vocabulary";
import { Inject, Injectable } from "@nestjs/common";
import { uniq } from "es-toolkit";

import { UserPreferenceReaderPort } from "#api/modules/identity/user-preferences/identity-user-preferences.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { resolveDeliveryTimezone } from "#api/shared/domain/time/time-zone-name";

import {
  type NotificationDeliveryPreference,
  UserNotificationSettingsPort,
} from "../../../shared/application/ports/user-notification-settings.port.js";
import {
  type RecipientLocaleOf,
  recipientLocaleOf,
  resolveRecipientLocale,
} from "../../../shared/domain/recipient-locale.domain-service.js";
import type { NotificationRecipientLocaleReaderPort } from "../../application/ports/notification-recipient-locale.reader.port.js";
import type { NotificationRecipientPreferenceReaderPort } from "../../application/ports/notification-recipient-preference.reader.port.js";
import type { NotificationRecipientTimezoneReaderPort } from "../../application/ports/notification-recipient-timezone.reader.port.js";

@Injectable()
export class CachedNotificationRecipientPreferenceAdapter
  implements
    NotificationRecipientPreferenceReaderPort,
    NotificationRecipientLocaleReaderPort,
    NotificationRecipientTimezoneReaderPort
{
  readonly #userSettings: UserNotificationSettingsPort;
  readonly #preferenceReader: UserPreferenceReaderPort;

  constructor(
    userSettings: UserNotificationSettingsPort,
    @Inject(UserPreferenceReaderPort)
    preferenceReader: UserPreferenceReaderPort,
  ) {
    this.#userSettings = userSettings;
    this.#preferenceReader = preferenceReader;
  }

  async getPreference(userId: UserId): Promise<NotificationDeliveryPreference> {
    const preference = await this.#preferenceReader.read(userId);
    return {
      ...preference,
      locale: resolveRecipientLocale({
        storedLocale: preference.locale ?? null,
        lastRequestLocale: null,
      }),
    };
  }

  async getLocale(userId: UserId): Promise<SupportedLocale> {
    const preference = await this.#preferenceReader.read(userId);
    // 마지막 요청 언어는 아직 어디에도 저장하지 않는다
    return resolveRecipientLocale({
      storedLocale: preference.locale ?? null,
      lastRequestLocale: null,
    });
  }

  async getLocales(userIds: readonly UserId[]): Promise<RecipientLocaleOf> {
    const uniqueUserIds = uniq(userIds.map((userId) => userId.value));
    if (uniqueUserIds.length === 0) {
      return recipientLocaleOf(new Map());
    }
    const preferences = await this.#userSettings.findPreferenceReadModelsByUserIds(
      uniqueUserIds.map((userId) => UserId.reconstitute(userId)),
    );
    return recipientLocaleOf(
      new Map(preferences.map((preference) => [preference.userId.value, preference.locale])),
    );
  }

  async getTimezones(userIds: readonly UserId[]): Promise<ReadonlyMap<string, string>> {
    const uniqueUserIds = uniq(userIds.map((userId) => userId.value));
    if (uniqueUserIds.length === 0) {
      return new Map();
    }
    const preferences = await this.#userSettings.findPreferenceReadModelsByUserIds(
      uniqueUserIds.map((userId) => UserId.reconstitute(userId)),
    );
    const timezones = new Map(
      preferences.map((preference) => [preference.userId.value, preference.timezone]),
    );
    return new Map(
      uniqueUserIds.map((userId) => [userId, resolveDeliveryTimezone(timezones.get(userId))]),
    );
  }
}
