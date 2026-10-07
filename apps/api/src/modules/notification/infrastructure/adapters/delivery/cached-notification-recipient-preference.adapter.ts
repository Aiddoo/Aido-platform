import { Inject, Injectable } from "@nestjs/common";
import { uniq } from "es-toolkit";

import {
  USER_PREFERENCE_READER,
  type UserPreferenceReaderPort,
} from "#api/modules/identity/identity-settings.public";
import { DEFAULT_LOCALE, type SupportedLocale, toSupportedLocale } from "#api/shared/domain/locale";

import { type NotificationRecipientLocaleReaderPort } from "../../../application/ports/delivery/notification-recipient-locale.reader.port.js";
import { type NotificationRecipientPreferenceReaderPort } from "../../../application/ports/delivery/notification-recipient-preference.reader.port.js";
import {
  USER_NOTIFICATION_SETTINGS,
  type NotificationDeliveryPreference,
  type UserNotificationSettingsPort,
} from "../../../application/ports/delivery/user-notification-settings.port.js";

@Injectable()
export class CachedNotificationRecipientPreferenceAdapter
  implements NotificationRecipientPreferenceReaderPort, NotificationRecipientLocaleReaderPort
{
  constructor(
    @Inject(USER_NOTIFICATION_SETTINGS)
    private readonly userSettings: UserNotificationSettingsPort,
    @Inject(USER_PREFERENCE_READER)
    private readonly preferenceReader: UserPreferenceReaderPort,
  ) {}

  async getPreference(userId: string): Promise<NotificationDeliveryPreference> {
    const preference = await this.preferenceReader.read(userId);
    return {
      ...preference,
      locale: preference.locale ?? DEFAULT_LOCALE,
    };
  }

  async getLocale(userId: string): Promise<SupportedLocale> {
    const preference = await this.getPreference(userId);
    return toSupportedLocale(preference.locale);
  }

  async getLocales(userIds: readonly string[]): Promise<ReadonlyMap<string, SupportedLocale>> {
    const uniqueUserIds = uniq(userIds);
    if (uniqueUserIds.length === 0) return new Map();
    const preferences = await this.userSettings.getPreferenceRecordsByUserIds(uniqueUserIds);
    const locales = new Map(
      preferences.map((preference) => [preference.userId, toSupportedLocale(preference.locale)]),
    );
    return new Map(uniqueUserIds.map((userId) => [userId, locales.get(userId) ?? DEFAULT_LOCALE]));
  }
}
