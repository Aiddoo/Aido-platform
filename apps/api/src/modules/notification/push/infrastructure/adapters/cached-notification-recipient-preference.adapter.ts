import type { SupportedLocale } from "@aido/api/vocabulary";
import { Inject, Injectable } from "@nestjs/common";
import { uniq } from "es-toolkit";

import { UserPreferenceReaderPort } from "#api/modules/identity/identity-settings.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { DEFAULT_LOCALE } from "#api/shared/domain/locale";
import { resolveDeliveryTimezone } from "#api/shared/domain/time/time-zone-name";

import type { NotificationRecipientLocaleReaderPort } from "../../application/ports/notification-recipient-locale.reader.port.js";
import type { NotificationRecipientPreferenceReaderPort } from "../../application/ports/notification-recipient-preference.reader.port.js";
import type { NotificationRecipientTimezoneReaderPort } from "../../application/ports/notification-recipient-timezone.reader.port.js";
import {
  type NotificationDeliveryPreference,
  UserNotificationSettingsPort,
} from "../../application/ports/user-notification-settings.port.js";
import { resolveRecipientLocale } from "../../domain/recipient-locale.domain-service.js";

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

  async getPreference(userId: string): Promise<NotificationDeliveryPreference> {
    const preference = await this.#preferenceReader.read(UserId.reconstitute(userId));
    return {
      ...preference,
      locale: preference.locale ?? DEFAULT_LOCALE,
    };
  }

  async getLocale(userId: string): Promise<SupportedLocale> {
    const preference = await this.#preferenceReader.read(UserId.reconstitute(userId));
    // 마지막 요청 언어는 아직 어디에도 저장하지 않는다
    return resolveRecipientLocale({
      storedLocale: preference.locale ?? null,
      lastRequestLocale: null,
    });
  }

  async getLocales(userIds: readonly string[]): Promise<ReadonlyMap<string, SupportedLocale>> {
    const uniqueUserIds = uniq(userIds);
    if (uniqueUserIds.length === 0) {
      return new Map();
    }
    const preferences = await this.#userSettings.getPreferenceRecordsByUserIds(uniqueUserIds);
    const storedLocales = new Map(
      preferences.map((preference) => [preference.userId, preference.locale]),
    );
    return new Map(
      uniqueUserIds.map((userId) => [
        userId,
        resolveRecipientLocale({
          storedLocale: storedLocales.get(userId) ?? null,
          lastRequestLocale: null,
        }),
      ]),
    );
  }

  async getTimezones(userIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
    const uniqueUserIds = uniq(userIds);
    if (uniqueUserIds.length === 0) {
      return new Map();
    }
    const preferences = await this.#userSettings.getPreferenceRecordsByUserIds(uniqueUserIds);
    const timezones = new Map(
      preferences.map((preference) => [preference.userId, preference.timezone]),
    );
    return new Map(
      uniqueUserIds.map((userId) => [userId, resolveDeliveryTimezone(timezones.get(userId))]),
    );
  }
}
