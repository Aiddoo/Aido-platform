import type { PreferenceResponse } from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";

import { EntitlementService } from "@/shared/application/entitlement/entitlement.service";

import {
	buildPreferenceView,
	DEFAULT_PREFERENCE_SNAPSHOT,
	type PreferenceSnapshot,
} from "../../../domain/services/preference-view";
import {
	USER_PREFERENCE_REPOSITORY,
	type UserPreferenceRecord,
	type UserPreferenceRepositoryPort,
} from "../../ports/user-preference.repository.port";
import {
	USER_SETTINGS_CACHE,
	type UserSettingsCachePort,
} from "../../ports/user-settings-cache.port";

/**
 * 사용자 설정 조회 유스케이스.
 *
 * 원본 설정을 캐시 스루로 읽고, 요청 시점에 프리미엄 게이팅을 적용해 응답한다.
 */
@Injectable()
export class GetPreferenceUseCase {
	constructor(
		@Inject(USER_PREFERENCE_REPOSITORY)
		private readonly preferenceRepository: UserPreferenceRepositoryPort,
		private readonly entitlementService: EntitlementService,
		@Inject(USER_SETTINGS_CACHE)
		private readonly cache: UserSettingsCachePort,
	) {}

	async execute(userId: string): Promise<PreferenceResponse> {
		const snapshot = await this.cache.wrapUserPreference(userId, async () => {
			const raw = await this.preferenceRepository.findByUserId(userId);
			return raw ? toSnapshot(raw) : DEFAULT_PREFERENCE_SNAPSHOT;
		});

		const hasPremium = await this.entitlementService.hasPremiumAccess(userId);
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
