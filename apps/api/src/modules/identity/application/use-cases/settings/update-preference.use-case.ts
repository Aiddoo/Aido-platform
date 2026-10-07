import type {
  UpdatePreferenceInput as PreferenceChanges,
  UpdatePreferenceResponse,
} from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { ReminderTimezoneCachePort } from "#api/modules/notification/notification-reminders-cache.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { normalizeIanaTimezone } from "#api/shared/domain/date/utils/timezone";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { ReminderTime } from "../../../domain/value-objects/settings/reminder-time.vo.js";
import { IdentitySettingsLogEvent } from "../../observability/settings/identity-settings-log.events.js";
import type { PreferenceEntitlementPort } from "../../ports/settings/preference-entitlement.port.js";
import { type ReminderScheduleEnqueuerPort } from "../../ports/settings/reminder-schedule.enqueuer.port.js";
import { type UserPreferenceRepositoryPort } from "../../ports/settings/user-preference.repository.port.js";
import { type UserSettingsCachePort } from "../../ports/settings/user-settings-cache.port.js";
import { buildUpdatedPreferenceView } from "../../read-models/settings/preference.read-model.js";

export type UpdatePreferenceInput = Readonly<PreferenceChanges> & {
  readonly userId: string;
};

interface UpdatePreferenceDependencies {
  readonly preferenceRepository: Pick<UserPreferenceRepositoryPort, "upsert">;
  readonly entitlement: PreferenceEntitlementPort;
  readonly cache: Pick<UserSettingsCachePort, "invalidateUserPreference">;
  readonly reminderTimezoneCache: ReminderTimezoneCachePort;
  readonly reminderEnqueuer: Pick<ReminderScheduleEnqueuerPort, "enqueueReminderHourChanged">;
  readonly logger: ApplicationLogger;
}

export class UpdatePreference {
  readonly #dependencies: UpdatePreferenceDependencies;

  constructor(dependencies: UpdatePreferenceDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdatePreferenceInput): Promise<UpdatePreferenceResponse> {
    const { userId } = input;
    const changesReminder =
      input.morningReminderHour !== undefined ||
      input.morningReminderMinute !== undefined ||
      input.eveningReminderHour !== undefined ||
      input.eveningReminderMinute !== undefined;

    if (changesReminder) {
      const hasPremium = await this.#dependencies.entitlement.hasPremiumAccess(userId);
      if (!hasPremium) {
        throw new ApplicationException(ErrorCode.PREFERENCE_1701);
      }
    }

    ReminderTime.assertValidRanges(input);

    const timezone =
      input.timezone === undefined ? undefined : normalizeIanaTimezone(input.timezone);
    if (input.timezone !== undefined && timezone === null) {
      throw new ApplicationException(ErrorCode.SYS_0002, {
        field: "timezone",
      });
    }

    const updated = await this.#dependencies.preferenceRepository.upsert(userId, {
      pushEnabled: input.pushEnabled,
      nightPushEnabled: input.nightPushEnabled,
      timezone: timezone ?? undefined,
      morningReminderHour: input.morningReminderHour,
      morningReminderMinute: input.morningReminderMinute,
      eveningReminderHour: input.eveningReminderHour,
      eveningReminderMinute: input.eveningReminderMinute,
      timeFormat: input.timeFormat,
      weatherMorningEnabled: input.weatherMorningEnabled,
      weatherMorningHour: input.weatherMorningHour,
      weatherMorningMinute: input.weatherMorningMinute,
      weatherEveningEnabled: input.weatherEveningEnabled,
      weatherEveningHour: input.weatherEveningHour,
      weatherEveningMinute: input.weatherEveningMinute,
    });
    await this.#dependencies.cache.invalidateUserPreference(userId);

    if (input.timezone !== undefined || input.pushEnabled !== undefined) {
      await this.#dependencies.reminderTimezoneCache.invalidateActiveTimezones();
    }

    this.#dependencies.logger.log({
      event: IdentitySettingsLogEvent.PREFERENCE_UPDATED,
      userId,
      pushEnabled: updated.pushEnabled,
      nightPushEnabled: updated.nightPushEnabled,
      timezone: updated.timezone,
    });

    // 변경한 시각의 cron이 이미 지난 경우에도 리마인더를 즉시 반영한다.
    if (changesReminder) {
      this.#dependencies.reminderEnqueuer.enqueueReminderHourChanged({
        userId,
        timezone: updated.timezone,
        morningReminderHour: input.morningReminderHour,
        morningReminderMinute: input.morningReminderMinute,
        eveningReminderHour: input.eveningReminderHour,
        eveningReminderMinute: input.eveningReminderMinute,
      });
    }

    return buildUpdatedPreferenceView(updated);
  }
}
