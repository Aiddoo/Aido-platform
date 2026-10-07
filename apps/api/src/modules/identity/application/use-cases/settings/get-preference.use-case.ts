import type { PreferenceResponse } from "@aido/api";

import type { EntitlementService } from "#api/modules/access/application/services/entitlement/entitlement.service";

import {
  buildPreferenceView,
  DEFAULT_PREFERENCE_SNAPSHOT,
  type PreferenceSnapshot,
} from "../../../domain/services/settings/preference-view.js";
import {
  type UserPreferenceRecord,
  type UserPreferenceRepositoryPort,
} from "../../ports/settings/user-preference.repository.port.js";
import { type UserSettingsCachePort } from "../../ports/settings/user-settings-cache.port.js";

/**
 * 사용자 설정 조회 유스케이스.
 *
 * 원본 설정을 캐시 스루로 읽고, 요청 시점에 프리미엄 게이팅을 적용해 응답한다.
 */
interface GetPreferenceDependencies {
  readonly preferenceRepository: UserPreferenceRepositoryPort;
  readonly entitlementService: EntitlementService;
  readonly cache: UserSettingsCachePort;
}

export class GetPreference {
  readonly #dependencies: GetPreferenceDependencies;

  constructor(dependencies: GetPreferenceDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: string): Promise<PreferenceResponse> {
    const snapshot = await this.#dependencies.cache.wrapUserPreference(userId, async () => {
      const raw = await this.#dependencies.preferenceRepository.findByUserId(userId);
      return raw ? toSnapshot(raw) : DEFAULT_PREFERENCE_SNAPSHOT;
    });

    const hasPremium = await this.#dependencies.entitlementService.hasPremiumAccess(userId);
    return buildPreferenceView(snapshot, hasPremium);
  }
}

function toSnapshot(record: UserPreferenceRecord): PreferenceSnapshot {
  return {
    pushEnabled: record.pushEnabled,
    nightPushEnabled: record.nightPushEnabled,
    timezone: record.timezone,
    locale: record.locale,
    morningReminderHour: record.morningReminderHour,
    morningReminderMinute: record.morningReminderMinute,
    eveningReminderHour: record.eveningReminderHour,
    eveningReminderMinute: record.eveningReminderMinute,
    timeFormat: record.timeFormat,
    weatherMorningEnabled: record.weatherMorningEnabled,
    weatherMorningHour: record.weatherMorningHour,
    weatherMorningMinute: record.weatherMorningMinute,
    weatherEveningEnabled: record.weatherEveningEnabled,
    weatherEveningHour: record.weatherEveningHour,
    weatherEveningMinute: record.weatherEveningMinute,
  };
}
