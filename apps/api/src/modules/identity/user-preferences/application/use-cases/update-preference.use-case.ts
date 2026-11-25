import { assertEntitled } from "#api/modules/access/feature-grants/access-feature-grants.public";
import type { ReminderTimezoneCachePort } from "#api/modules/notification/reminders/notification-reminders-queries.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  isUtcOffsetTimezone,
  parseDeviceReportedTimezone,
  parseTimezoneName,
} from "#api/shared/domain/time/timezone-name";

import { ReminderTime } from "../../domain/reminder-time.vo.js";
import type { PreferenceEntitlementPort } from "../ports/preference-entitlement.port.js";
import { type ReminderScheduleEnqueuerPort } from "../ports/reminder-schedule-enqueuer.port.js";
import type { TodoTimezoneRebaseEnqueuerPort } from "../ports/todo-timezone-rebase-enqueuer.port.js";
import { type UserPreferenceRepositoryPort } from "../ports/user-preference.repository.port.js";
import { type UserSettingsCachePort } from "../ports/user-settings-cache.port.js";
import {
  toUpdatedPreferenceReadModel,
  type PreferenceReadModel,
} from "../read-models/preference.read-model.js";
import { invalidTimezone } from "../user-preferences.errors.js";
import { UserPreferenceLockKeys } from "../user-preferences.lock-keys.js";
import { UserPreferenceLogEvent } from "../user-preferences.log-events.js";

export type UpdatePreferenceCommand = Readonly<Partial<PreferenceReadModel>> & {
  readonly userId: string;
};

interface UpdatePreferenceDependencies {
  readonly preferenceRepository: Pick<UserPreferenceRepositoryPort, "getByUserId" | "save">;
  readonly mutationLock: Pick<MutationLockPort, "acquire">;
  readonly entitlement: PreferenceEntitlementPort;
  readonly cache: Pick<UserSettingsCachePort, "invalidateUserPreference">;
  readonly reminderTimezoneCache: ReminderTimezoneCachePort;
  readonly reminderEnqueuer: Pick<ReminderScheduleEnqueuerPort, "enqueueReminderHourChanged">;
  readonly todoTimezoneRebase: TodoTimezoneRebaseEnqueuerPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

/**
 * 설정 변경 body의 시간대. 모르는 이름은 거절하고, 옛 서버가 받던 고정 오프셋과 UTC와 같은 이름(기기 보고 규칙)은
 * 출시 계약을 좁히지 않도록 4xx 없이 저장하지 않는다.
 */
function requestedTimezoneOf(raw: string | undefined): string | undefined {
  if (raw == null) {
    return undefined;
  }
  if (parseTimezoneName(raw) == null && !isUtcOffsetTimezone(raw)) {
    throw invalidTimezone();
  }
  return parseDeviceReportedTimezone(raw) ?? undefined;
}

export class UpdatePreferenceUseCase {
  readonly #dependencies: UpdatePreferenceDependencies;

  constructor(dependencies: UpdatePreferenceDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdatePreferenceCommand): Promise<PreferenceReadModel> {
    const userId = UserId.reconstitute(input.userId);
    const changesReminder =
      input.morningReminderHour != null ||
      input.morningReminderMinute != null ||
      input.eveningReminderHour != null ||
      input.eveningReminderMinute != null;

    if (changesReminder) {
      await assertEntitled(this.#dependencies.entitlement, userId, "CUSTOM_REMINDER_TIME");
    }

    ReminderTime.create(input);

    const timezone = requestedTimezoneOf(input.timezone);

    const { preferenceRepository, todoTimezoneRebase, clock } = this.#dependencies;
    const updated = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([UserPreferenceLockKeys.preference(userId)]);
      const preference = await preferenceRepository.getByUserId(userId);
      const previousTimezone = preference.settings.timezone;
      const changed = preference.changeSettings({
        pushEnabled: input.pushEnabled,
        nightPushEnabled: input.nightPushEnabled,
        timezone,
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
        aiPushEnabled: input.aiPushEnabled,
      });
      if (!changed) {
        return preference.settings;
      }
      await preferenceRepository.save(preference);
      if (preference.settings.timezone !== previousTimezone) {
        await todoTimezoneRebase.enqueueRebase(userId, clock.now());
      }
      return preference.settings;
    });
    await this.#dependencies.cache.invalidateUserPreference(userId);

    // 저장하지 않은 시간대(UTC 보고·고정 오프셋)는 활성 시간대 목록을 바꾸지 않는다
    if (timezone != null || input.pushEnabled != null) {
      await this.#dependencies.reminderTimezoneCache.invalidateActiveTimezones();
    }

    this.#dependencies.logger.log({
      event: UserPreferenceLogEvent.UPDATED,
      userId: input.userId,
      pushEnabled: updated.pushEnabled,
      nightPushEnabled: updated.nightPushEnabled,
      timezone: updated.timezone,
    });

    // 변경한 시각의 cron이 이미 지난 경우에도 리마인더를 즉시 반영한다.
    if (changesReminder) {
      this.#dependencies.reminderEnqueuer.enqueueReminderHourChanged({
        userId: UserId.reconstitute(input.userId),
        timezone: updated.timezone,
        morningReminderHour: input.morningReminderHour,
        morningReminderMinute: input.morningReminderMinute,
        eveningReminderHour: input.eveningReminderHour,
        eveningReminderMinute: input.eveningReminderMinute,
      });
    }

    return toUpdatedPreferenceReadModel(updated);
  }
}
