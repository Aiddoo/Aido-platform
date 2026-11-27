import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, inArray, not, or, type SQL } from "drizzle-orm";

import { userWeatherPreference } from "#api/modules/identity/user-preferences/identity-user-preferences.public";
import { userRecipients } from "#api/modules/identity/users/identity-users.public";
import {
  hasUserLocation,
  userCoordinates,
} from "#api/modules/weather/user-locations/weather-user-locations.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";

import type {
  WeatherReminderParams,
  WeatherReminderReaderPort,
} from "../../application/ports/weather-reminder-reader.port.js";
import type {
  WeatherFallbackUserReadModel,
  WeatherReminderUserReadModel,
} from "../../application/read-models/scheduler.read-model.js";

type WeatherPreference = ReturnType<typeof userWeatherPreference>;

// 아침·저녁 날씨 알림의 켜짐·시각 칸
const WEATHER_SLOTS = {
  morning: (preference: WeatherPreference) => ({
    enabled: preference.weatherMorningEnabled,
    hour: preference.weatherMorningHour,
    minute: preference.weatherMorningMinute,
  }),
  evening: (preference: WeatherPreference) => ({
    enabled: preference.weatherEveningEnabled,
    hour: preference.weatherEveningHour,
    minute: preference.weatherEveningMinute,
  }),
} as const;

type WeatherSlot = keyof typeof WEATHER_SLOTS;

@Injectable()
export class DrizzleWeatherReminderReader implements WeatherReminderReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  listWeatherMorningUsersWithLocation(
    params: WeatherReminderParams,
  ): Promise<WeatherReminderUserReadModel[]> {
    return this.#usersWithLocation(params, "morning");
  }

  listWeatherMorningFallbackUsers(
    params: WeatherReminderParams,
  ): Promise<WeatherFallbackUserReadModel[]> {
    return this.#fallbackUsers(params, "morning");
  }

  listWeatherEveningUsersWithLocation(
    params: WeatherReminderParams,
  ): Promise<WeatherReminderUserReadModel[]> {
    return this.#usersWithLocation(params, "evening");
  }

  listWeatherEveningFallbackUsers(
    params: WeatherReminderParams,
  ): Promise<WeatherFallbackUserReadModel[]> {
    return this.#fallbackUsers(params, "evening");
  }

  async #usersWithLocation(
    params: WeatherReminderParams,
    slot: WeatherSlot,
  ): Promise<WeatherReminderUserReadModel[]> {
    if (params.times.length === 0) {
      return [];
    }
    const recipients = userRecipients();
    const preference = userWeatherPreference();
    const coordinates = userCoordinates();
    const rows = await this.#db
      .select({
        id: recipients.userId,
        locale: preference.locale,
        timeFormat: preference.timeFormat,
        timezone: preference.timezone,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      })
      .from(recipients.table)
      .innerJoin(preference, eq(preference.userId, recipients.userId))
      .innerJoin(coordinates, eq(coordinates.userId, recipients.userId))
      .where(this.#recipientCondition(params, slot, preference));
    return rows.map(({ id, locale, timeFormat, timezone, latitude, longitude }) => ({
      id,
      preference: { locale, timeFormat },
      location: { latitude, longitude },
      timezone,
    }));
  }

  async #fallbackUsers(
    params: WeatherReminderParams,
    slot: WeatherSlot,
  ): Promise<WeatherFallbackUserReadModel[]> {
    if (params.times.length === 0) {
      return [];
    }
    const recipients = userRecipients();
    const preference = userWeatherPreference();
    const rows = await this.#db
      .select({ id: recipients.userId, locale: preference.locale })
      .from(recipients.table)
      .innerJoin(preference, eq(preference.userId, recipients.userId))
      .where(
        and(
          this.#recipientCondition(params, slot, preference),
          not(hasUserLocation(recipients.userId)),
        ),
      );
    return rows.map(({ id, locale }) => ({ id, preference: { locale } }));
  }

  #recipientCondition(
    params: WeatherReminderParams,
    slot: WeatherSlot,
    preference: WeatherPreference,
  ): SQL | undefined {
    const recipients = userRecipients();
    const columns = WEATHER_SLOTS[slot](preference);
    return and(
      params.userId == null ? undefined : eq(recipients.userId, params.userId.value),
      recipients.active,
      eq(columns.enabled, true),
      inArray(preference.timezone, [...params.timezones]),
      or(
        ...params.times.map(({ hour, minute }) =>
          and(eq(columns.hour, hour), eq(columns.minute, minute)),
        ),
      ),
    );
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
