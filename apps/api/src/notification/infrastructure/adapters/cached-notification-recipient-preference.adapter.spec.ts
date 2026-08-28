import { USER_PREFERENCE_DEFAULTS } from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createUserNotificationSettingsMock } from "@test/mocks/ports/notification.mock";

import {
	type CachedUserPreference,
	CacheService,
} from "@/shared/infrastructure/cache/cache.service";

import {
	USER_NOTIFICATION_SETTINGS,
	type NotificationDeliveryPreference,
	type UserNotificationSettingsPort,
} from "../../application/ports/user-notification-settings.port";
import { CachedNotificationRecipientPreferenceAdapter } from "./cached-notification-recipient-preference.adapter";

function createPreference(
	overrides: Partial<NotificationDeliveryPreference> = {},
): NotificationDeliveryPreference {
	return {
		pushEnabled: true,
		nightPushEnabled: true,
		timezone: "Asia/Seoul",
		locale: "en",
		morningReminderHour: 8,
		morningReminderMinute: 10,
		eveningReminderHour: 19,
		eveningReminderMinute: 20,
		timeFormat: "TWENTY_FOUR_HOUR",
		weatherMorningEnabled: true,
		weatherMorningHour: 7,
		weatherMorningMinute: 30,
		weatherEveningEnabled: false,
		weatherEveningHour: 18,
		weatherEveningMinute: 40,
		...overrides,
	};
}

describe("CachedNotificationRecipientPreferenceAdapter - 수신자 설정 cache-aside", () => {
	let reader: CachedNotificationRecipientPreferenceAdapter;
	let userSettings: Mocked<UserNotificationSettingsPort>;
	let cacheService: Mocked<CacheService>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(CachedNotificationRecipientPreferenceAdapter)
			.mock<UserNotificationSettingsPort>(USER_NOTIFICATION_SETTINGS)
			.impl(() => createUserNotificationSettingsMock())
			.compile();

		reader = unit;
		userSettings = unitRef.get(USER_NOTIFICATION_SETTINGS);
		cacheService = unitRef.get(CacheService);
	});

	it("캐시 미스는 알림 전달에 필요한 최소 설정만 projection해 저장한다", async () => {
		// Given - user-settings 레코드는 알림 전달과 무관한 필드도 포함할 수 있음
		const userId = "user-preference";
		const preference = createPreference();
		const persistedPreference = {
			...preference,
			currentStreak: 17,
			longestStreak: 42,
			lastCompletedDate: new Date("2026-08-28T00:00:00.000Z"),
		};
		let cachedSnapshot: CachedUserPreference | undefined;
		cacheService.wrapUserPreference.mockImplementation(async (_cachedUserId, loader) => {
			cachedSnapshot = await loader();
			return cachedSnapshot;
		});
		userSettings.getPreferenceRecord.mockResolvedValue(persistedPreference);

		// When - 수신자 설정 조회
		const result = await reader.getPreference(userId);

		// Then - 공개 결과와 캐시 payload 모두 notification 소유 최소 계약만 포함
		expect(cacheService.wrapUserPreference).toHaveBeenCalledWith(userId, expect.any(Function));
		expect(userSettings.getPreferenceRecord).toHaveBeenCalledWith(userId);
		expect(result).toEqual(preference);
		expect(cachedSnapshot).toEqual(preference);
		expect(cachedSnapshot).not.toHaveProperty("currentStreak");
		expect(cachedSnapshot).not.toHaveProperty("longestStreak");
		expect(cachedSnapshot).not.toHaveProperty("lastCompletedDate");
	});

	it("설정 행이 없으면 validators의 하위 호환 기본값과 기본 로케일을 반환한다", async () => {
		// Given - 캐시와 영속 설정 모두 미존재
		cacheService.wrapUserPreference.mockImplementation((_cachedUserId, loader) => loader());
		userSettings.getPreferenceRecord.mockResolvedValue(null);

		// When - 신규 또는 구버전 사용자의 설정 조회
		const result = await reader.getPreference("user-without-preference");

		// Then - 알림 수신을 보수적으로 거부하는 공유 기본값 사용
		expect(result).toEqual({
			pushEnabled: USER_PREFERENCE_DEFAULTS.PUSH_ENABLED,
			nightPushEnabled: USER_PREFERENCE_DEFAULTS.NIGHT_PUSH_ENABLED,
			timezone: USER_PREFERENCE_DEFAULTS.TIMEZONE,
			locale: "ko",
			morningReminderHour: USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_HOUR,
			morningReminderMinute: USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_MINUTE,
			eveningReminderHour: USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_HOUR,
			eveningReminderMinute: USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_MINUTE,
			timeFormat: USER_PREFERENCE_DEFAULTS.TIME_FORMAT,
			weatherMorningEnabled: USER_PREFERENCE_DEFAULTS.WEATHER_MORNING_ENABLED,
			weatherMorningHour: USER_PREFERENCE_DEFAULTS.WEATHER_MORNING_HOUR,
			weatherMorningMinute: USER_PREFERENCE_DEFAULTS.WEATHER_MORNING_MINUTE,
			weatherEveningEnabled: USER_PREFERENCE_DEFAULTS.WEATHER_EVENING_ENABLED,
			weatherEveningHour: USER_PREFERENCE_DEFAULTS.WEATHER_EVENING_HOUR,
			weatherEveningMinute: USER_PREFERENCE_DEFAULTS.WEATHER_EVENING_MINUTE,
		});
	});

	it("locale 필드가 없는 구버전 캐시 엔트리는 기본 로케일 ko로 보정한다", async () => {
		// Given - locale 도입 전 저장된 캐시 스냅샷
		const legacyPreference: CachedUserPreference = { ...createPreference() };
		delete legacyPreference.locale;
		cacheService.wrapUserPreference.mockResolvedValue(legacyPreference);

		// When - 구버전 캐시에서 설정과 로케일 조회
		const preference = await reader.getPreference("legacy-user");
		const locale = await reader.getLocale("legacy-user");

		// Then - undefined를 공개 경계로 누출하지 않고 DB 재조회도 하지 않음
		expect(preference.locale).toBe("ko");
		expect(locale).toBe("ko");
		expect(userSettings.getPreferenceRecord).not.toHaveBeenCalled();
	});

	it.each([
		["ko", "ko"],
		["en", "en"],
		["fr", "ko"],
	])("저장 locale %s를 지원 locale %s로 안전하게 좁힌다", async (storedLocale, expected) => {
		// Given - 캐시에 저장된 임의 locale 값
		cacheService.wrapUserPreference.mockResolvedValue(createPreference({ locale: storedLocale }));

		// When - 알림 카피용 locale 조회
		const result = await reader.getLocale("locale-user");

		// Then - 지원 언어만 반환하고 알 수 없는 값은 ko로 폴백
		expect(result).toBe(expected);
	});
});
