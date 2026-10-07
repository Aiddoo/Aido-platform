import type { UpdatePreferenceInput, UpdatePreferenceResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { EntitlementService } from "#api/modules/access/application/services/entitlement/entitlement.service";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { normalizeIanaTimezone } from "#api/shared/domain/date/utils/timezone";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { buildUpdatedPreferenceView } from "../../../domain/services/settings/preference-view.js";
import { ReminderTime } from "../../../domain/value-objects/settings/reminder-time.vo.js";
import { type ReminderScheduleEnqueuerPort } from "../../ports/settings/reminder-schedule.enqueuer.port.js";
import { type UserPreferenceRepositoryPort } from "../../ports/settings/user-preference.repository.port.js";
import { type UserSettingsCachePort } from "../../ports/settings/user-settings-cache.port.js";

/**
 * 사용자 설정 수정 유스케이스.
 *
 * 리마인더 시간 변경은 프리미엄 전용(PREFERENCE_1701)이며, 시간 범위 불변식
 * (PREFERENCE_1702)을 검증한다. 변경 시 캐시 무효화 및 즉시 반영 잡을 등록한다.
 */
interface UpdatePreferenceDependencies {
  readonly preferenceRepository: UserPreferenceRepositoryPort;
  readonly entitlementService: EntitlementService;
  readonly cache: UserSettingsCachePort;
  readonly reminderEnqueuer: ReminderScheduleEnqueuerPort;
  readonly logger: ApplicationLogger;
}

export class UpdatePreference {
  readonly #dependencies: UpdatePreferenceDependencies;

  constructor(dependencies: UpdatePreferenceDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: string, input: UpdatePreferenceInput): Promise<UpdatePreferenceResponse> {
    const changesReminder =
      input.morningReminderHour !== undefined ||
      input.morningReminderMinute !== undefined ||
      input.eveningReminderHour !== undefined ||
      input.eveningReminderMinute !== undefined;

    // 리마인더 시간 변경 시 프리미엄 체크
    if (changesReminder) {
      const hasPremium = await this.#dependencies.entitlementService.hasPremiumAccess(userId);
      if (!hasPremium) {
        throw new ApplicationException(ErrorCode.PREFERENCE_1701);
      }
    }

    // 리마인더 시간 범위 검증 (오전: 0-11, 오후: 12-23)
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

    // 타임존 또는 pushEnabled 변경 시 활성 타임존 목록 캐시 무효화
    if (input.timezone !== undefined || input.pushEnabled !== undefined) {
      await this.#dependencies.cache.invalidateActiveTimezones();
    }

    this.#dependencies.logger.log(
      `User ${userId} updated preference: pushEnabled=${updated.pushEnabled}, nightPushEnabled=${updated.nightPushEnabled}, timezone=${updated.timezone}`,
    );

    // 리마인더 시간 변경 시 즉시 반영 큐 잡 등록
    // (현재 시간과 동일한 시간으로 변경했을 때 크론이 이미 지나간 경우 보완)
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
