import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";

import type {
  WeatherReminderParams,
  WeatherReminderReaderPort,
} from "../../application/ports/weather-reminder-reader.port.js";
import type {
  WeatherFallbackUserReadModel,
  WeatherReminderUserReadModel,
} from "../../application/read-models/scheduler.read-model.js";
import { withPreferenceTimezone } from "./scheduler.query-fragment.js";

@Injectable()
export class DrizzleWeatherReminderReader implements WeatherReminderReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  async findWeatherMorningUsersWithLocation(
    params: WeatherReminderParams,
  ): Promise<WeatherReminderUserReadModel[]> {
    const { timezones, hour, minute, userId } = params;
    const rows = await this.#db.query.user.findMany({
      columns: { id: true },
      where: {
        ...(userId != null && { id: userId.value }),
        status: "ACTIVE",
        deletedAt: { isNull: true },
        preference: {
          weatherMorningEnabled: true,
          timezone: { in: [...timezones] },
          weatherMorningHour: hour,
          weatherMorningMinute: minute,
        },
        location: true,
      },
      with: {
        preference: { columns: { locale: true, timezone: true } },
        location: { columns: { latitude: true, longitude: true } },
      },
    });
    return withPreferenceTimezone(rows);
  }

  findWeatherMorningFallbackUsers(
    params: WeatherReminderParams,
  ): Promise<WeatherFallbackUserReadModel[]> {
    const { timezones, hour, minute, userId } = params;
    return this.#db.query.user.findMany({
      columns: { id: true },
      where: {
        ...(userId != null && { id: userId.value }),
        status: "ACTIVE",
        deletedAt: { isNull: true },
        preference: {
          weatherMorningEnabled: true,
          timezone: { in: [...timezones] },
          weatherMorningHour: hour,
          weatherMorningMinute: minute,
        },
        NOT: { location: true },
      },
      with: { preference: { columns: { locale: true } } },
    });
  }

  async findWeatherEveningUsersWithLocation(
    params: WeatherReminderParams,
  ): Promise<WeatherReminderUserReadModel[]> {
    const { timezones, hour, minute, userId } = params;
    const rows = await this.#db.query.user.findMany({
      columns: { id: true },
      where: {
        ...(userId != null && { id: userId.value }),
        status: "ACTIVE",
        deletedAt: { isNull: true },
        preference: {
          weatherEveningEnabled: true,
          timezone: { in: [...timezones] },
          weatherEveningHour: hour,
          weatherEveningMinute: minute,
        },
        location: true,
      },
      with: {
        preference: { columns: { locale: true, timezone: true } },
        location: { columns: { latitude: true, longitude: true } },
      },
    });
    return withPreferenceTimezone(rows);
  }

  findWeatherEveningFallbackUsers(
    params: WeatherReminderParams,
  ): Promise<WeatherFallbackUserReadModel[]> {
    const { timezones, hour, minute, userId } = params;
    return this.#db.query.user.findMany({
      columns: { id: true },
      where: {
        ...(userId != null && { id: userId.value }),
        status: "ACTIVE",
        deletedAt: { isNull: true },
        preference: {
          weatherEveningEnabled: true,
          timezone: { in: [...timezones] },
          weatherEveningHour: hour,
          weatherEveningMinute: minute,
        },
        NOT: { location: true },
      },
      with: { preference: { columns: { locale: true } } },
    });
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
