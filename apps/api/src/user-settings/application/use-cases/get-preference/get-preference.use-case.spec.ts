/**
 * GetPreferenceUseCase 단위 테스트
 *
 * - 캐시 스루로 원본 스냅샷을 읽는다(캐시 히트 시 리포지토리 미조회).
 * - 요청 시점에 프리미엄 게이팅을 적용한다(비프리미엄은 리마인더 기본값 고정).
 * - 레코드가 없으면 기본 스냅샷을 사용한다.
 */
import { USER_PREFERENCE_DEFAULTS } from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createUserSettingsCacheMock } from "@test/mocks/ports/user-settings-cache.mock";
import { createUserPreferenceRepositoryMock } from "@test/mocks/ports/user-settings.mock";

import { EntitlementService } from "@/shared/application/entitlement/entitlement.service";

import type { UserPreferenceRecord } from "../../../domain/records/user-preference.record";
import type { PreferenceSnapshot } from "../../../domain/services/preference-view";
import {
	USER_PREFERENCE_REPOSITORY,
	type UserPreferenceRepositoryPort,
} from "../../ports/user-preference.repository.port";
import {
	USER_SETTINGS_CACHE,
	type UserSettingsCachePort,
} from "../../ports/user-settings-cache.port";
import { GetPreferenceUseCase } from "./get-preference.use-case";

const userId = "user-1";

const record: UserPreferenceRecord = {
	pushEnabled: true,
	nightPushEnabled: true,
	timezone: "Asia/Seoul",
	locale: "ko",
	morningReminderHour: 7,
	morningReminderMinute: 30,
	eveningReminderHour: 18,
	eveningReminderMinute: 15,
	timeFormat: "TWENTY_FOUR_HOUR",
	weatherMorningEnabled: true,
	weatherMorningHour: 7,
	weatherMorningMinute: 0,
	weatherEveningEnabled: true,
	weatherEveningHour: 17,
	weatherEveningMinute: 30,
	currentStreak: 0,
	longestStreak: 0,
	lastCompletedDate: null,
};

describe("GetPreferenceUseCase", () => {
	let useCase: GetPreferenceUseCase;
	let repo: Mocked<UserPreferenceRepositoryPort>;
	let entitlement: Mocked<EntitlementService>;
	let cache: Mocked<UserSettingsCachePort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(GetPreferenceUseCase)
			.mock<UserPreferenceRepositoryPort>(USER_PREFERENCE_REPOSITORY)
			.impl(() => createUserPreferenceRepositoryMock())
			.mock<UserSettingsCachePort>(USER_SETTINGS_CACHE)
			.impl(() => createUserSettingsCacheMock())
			.compile();
		useCase = unit;
		repo = unitRef.get<UserPreferenceRepositoryPort>(USER_PREFERENCE_REPOSITORY);
		entitlement = unitRef.get(EntitlementService);
		cache = unitRef.get<UserSettingsCachePort>(USER_SETTINGS_CACHE);
		// 캐시 미스: 팩토리를 실행해 원본을 로드한다(캐시 스루).
		cache.wrapUserPreference.mockImplementation((_userId, factory) => factory());
	});

	it("캐시 스루로 원본을 읽고, 프리미엄이면 저장된 리마인더 시간을 그대로 반환한다", async () => {
		// Given: 저장된 리마인더 07:30 / 18:15 + 프리미엄 사용자
		repo.findByUserId.mockResolvedValue(record);
		entitlement.hasPremiumAccess.mockResolvedValue(true);

		// When: 설정 조회
		const result = await useCase.execute(userId);

		// Then: 팩토리로 원본을 읽고 저장된 리마인더 시간이 그대로 노출
		expect(cache.wrapUserPreference).toHaveBeenCalledWith(userId, expect.any(Function));
		expect(repo.findByUserId).toHaveBeenCalledWith(userId);
		expect(entitlement.hasPremiumAccess).toHaveBeenCalledWith(userId);
		expect(result).toMatchObject({
			timezone: "Asia/Seoul",
			timeFormat: "TWENTY_FOUR_HOUR",
			morningReminderHour: 7,
			morningReminderMinute: 30,
			eveningReminderHour: 18,
			eveningReminderMinute: 15,
		});
	});

	it("비프리미엄은 리마인더 시간이 기본값(08:00/19:00)으로 고정된다", async () => {
		// Given: 저장된 리마인더 07:30 / 18:15 + 비프리미엄 사용자
		repo.findByUserId.mockResolvedValue(record);
		entitlement.hasPremiumAccess.mockResolvedValue(false);

		// When: 설정 조회
		const result = await useCase.execute(userId);

		// Then: 리마인더는 기본값으로 게이팅, 그 외 필드는 저장값 유지
		expect(result.morningReminderHour).toBe(USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_HOUR);
		expect(result.morningReminderMinute).toBe(USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_MINUTE);
		expect(result.eveningReminderHour).toBe(USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_HOUR);
		expect(result.eveningReminderMinute).toBe(USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_MINUTE);
		expect(result.timezone).toBe("Asia/Seoul");
		expect(result.timeFormat).toBe("TWENTY_FOUR_HOUR");
	});

	it("레코드가 없으면 기본 스냅샷을 사용한다", async () => {
		// Given: 설정 레코드 미존재 + 프리미엄(게이팅 영향 격리)
		repo.findByUserId.mockResolvedValue(null);
		entitlement.hasPremiumAccess.mockResolvedValue(true);

		// When: 설정 조회
		const result = await useCase.execute(userId);

		// Then: 전 필드가 기본값
		expect(result).toMatchObject({
			pushEnabled: USER_PREFERENCE_DEFAULTS.PUSH_ENABLED,
			nightPushEnabled: USER_PREFERENCE_DEFAULTS.NIGHT_PUSH_ENABLED,
			timezone: USER_PREFERENCE_DEFAULTS.TIMEZONE,
			morningReminderHour: USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_HOUR,
			eveningReminderHour: USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_HOUR,
			timeFormat: USER_PREFERENCE_DEFAULTS.TIME_FORMAT,
		});
	});

	it("캐시 히트 시 리포지토리를 조회하지 않고 스냅샷 위에 게이팅만 적용한다", async () => {
		// Given: 캐시가 팩토리 실행 없이 저장된 스냅샷을 반환
		const cachedSnapshot: PreferenceSnapshot = {
			pushEnabled: true,
			nightPushEnabled: false,
			timezone: "Asia/Tokyo",
			locale: "ja",
			morningReminderHour: 9,
			morningReminderMinute: 45,
			eveningReminderHour: 20,
			eveningReminderMinute: 10,
			timeFormat: "TWELVE_HOUR",
			weatherMorningEnabled: false,
			weatherMorningHour: 6,
			weatherMorningMinute: 0,
			weatherEveningEnabled: false,
			weatherEveningHour: 18,
			weatherEveningMinute: 0,
		};
		cache.wrapUserPreference.mockResolvedValue(cachedSnapshot);
		entitlement.hasPremiumAccess.mockResolvedValue(true);

		// When: 설정 조회
		const result = await useCase.execute(userId);

		// Then: 리포지토리 미조회, 캐시 스냅샷 값이 그대로 반영
		expect(repo.findByUserId).not.toHaveBeenCalled();
		expect(result).toMatchObject({
			timezone: "Asia/Tokyo",
			morningReminderHour: 9,
			eveningReminderHour: 20,
		});
	});
});
