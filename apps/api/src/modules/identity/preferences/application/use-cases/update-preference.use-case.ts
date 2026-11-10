import type {
  UpdatePreferenceInput as PreferenceChanges,
  UpdatePreferenceResponse,
} from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import { assertEntitled } from "#api/modules/access/access-entitlement.public";
import type { ReminderTimezoneCachePort } from "#api/modules/notification/notification-reminders-cache.public";
import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import { normalizeIanaTimezone } from "#api/shared/domain/date/utils/timezone";

import { ReminderTime } from "../../domain/reminder-time.vo.js";
import type { PreferenceEntitlementPort } from "../ports/preference-entitlement.port.js";
import { type ReminderScheduleEnqueuerPort } from "../ports/reminder-schedule-enqueuer.port.js";
import type { TodoTimezoneRebaseEnqueuerPort } from "../ports/todo-timezone-rebase-enqueuer.port.js";
import { type UserPreferenceRepositoryPort } from "../ports/user-preference.repository.port.js";
import { type UserSettingsCachePort } from "../ports/user-settings-cache.port.js";
import { PreferenceLogEvent } from "../preferences.log-events.js";
import { buildUpdatedPreferenceView } from "../read-models/preference.read-model.js";

export type UpdatePreferenceCommand = Readonly<PreferenceChanges> & {
  readonly userId: string;
};

interface UpdatePreferenceDependencies {
  readonly preferenceRepository: Pick<UserPreferenceRepositoryPort, "findByUserId" | "upsert">;
  readonly entitlement: PreferenceEntitlementPort;
  readonly cache: Pick<UserSettingsCachePort, "invalidateUserPreference">;
  readonly reminderTimezoneCache: ReminderTimezoneCachePort;
  readonly reminderEnqueuer: Pick<ReminderScheduleEnqueuerPort, "enqueueReminderHourChanged">;
  readonly todoTimezoneRebase: TodoTimezoneRebaseEnqueuerPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLoggerPort;
}

export class UpdatePreferenceUseCase {
  readonly #dependencies: UpdatePreferenceDependencies;

  constructor(dependencies: UpdatePreferenceDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdatePreferenceCommand): Promise<UpdatePreferenceResponse> {
    const { userId } = input;
    const changesReminder =
      input.morningReminderHour != null ||
      input.morningReminderMinute != null ||
      input.eveningReminderHour != null ||
      input.eveningReminderMinute != null;

    if (changesReminder) {
      await assertEntitled(this.#dependencies.entitlement, userId, "CUSTOM_REMINDER_TIME");
    }

    ReminderTime.assertValidRanges(input);

    const timezone = input.timezone == null ? undefined : normalizeIanaTimezone(input.timezone);
    if (input.timezone != null && timezone == null) {
      throw new ApplicationException(ErrorCode.SYS_0002, {
        field: "timezone",
      });
    }

    const { preferenceRepository, todoTimezoneRebase } = this.#dependencies;
    const updated = await this.#dependencies.unitOfWork.run(async () => {
      const timezoneChanged =
        timezone != null &&
        (await preferenceRepository.findByUserId(userId))?.timezone !== timezone;
      const written = await preferenceRepository.upsert(userId, {
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
      if (timezoneChanged) {
        await todoTimezoneRebase.enqueueRebase(userId, now());
      }
      return written;
    });
    await this.#dependencies.cache.invalidateUserPreference(userId);

    if (input.timezone != null || input.pushEnabled != null) {
      await this.#dependencies.reminderTimezoneCache.invalidateActiveTimezones();
    }

    this.#dependencies.logger.log({
      event: PreferenceLogEvent.PREFERENCE_UPDATED,
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
